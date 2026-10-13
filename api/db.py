"""生职迹 Career Trail · 数据库访问层
前端后端共享的 SQLite 连接与建表逻辑。

多设备隔离（v1.7 起）：
  应用发布到公网后，同一个后端会被很多浏览器打开。「经历库」的语义是
  「一个人的完整工作区」，不能让访客互相看到数据。这里没有引入登录体系，
  而是用一个更轻的办法 —— 前端为每个浏览器生成一个设备标识，随请求头
  `X-CV-Owner` 带上来；后端把不同标识的数据落到**各自独立的 SQLite 文件**。

  这样做的好处是隔离是「结构性」的：所有既有查询一行都不用改，凡是按
  vault_id 归属的资源（经历 / 简历 / 回收站 / 备份）天然就只在自己的库里。
  标识为空 = 本机模式（localhost 开发、命令行脚本），仍走默认库，老数据
  与迁移脚本完全不受影响。
"""
from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime
from pathlib import Path

from .infolines import normalize_sections, split_info_lines

DATA_DIR = Path(__file__).parent.parent / "data"
DB_PATH = DATA_DIR / "careervault.db"

# 「经历库」= 一个人的完整工作区（经历 + 简历）。
# 默认库的名字：帮朋友建库时用户可以改成「某某的经历库」。
DEFAULT_VAULT_NAME = "我的经历库"

# ---------------- 设备隔离 ----------------

_OWNER_RE = re.compile(r"[^A-Za-z0-9-]+")

_owner_token: ContextVar[str] = ContextVar("cv_owner_token", default="")
# 已经建过表的库文件路径（进程内缓存，避免每个请求都跑一遍 PRAGMA）
_initialized: set[str] = set()


def sanitize_owner(raw: str) -> str:
    """把请求头里的设备标识清洗成可安全用作文件名的一段字符。

    允许字母数字与连字符、最长 48 位；其余一律丢弃。设备标识会拼进
    SQLite 文件名，这一步是安全边界，不能省。
    """
    return _OWNER_RE.sub("", str(raw or ""))[:48]


def set_owner(raw: str) -> None:
    """由 main.py 的中间件在每个请求开始时调用。"""
    _owner_token.set(sanitize_owner(raw))


def current_owner() -> str:
    return _owner_token.get()


def db_path() -> Path:
    """当前请求应该用的数据库文件。

    本机模式（owner 为空）→ 默认库；线上每个设备一个独立文件。
    """
    owner = _owner_token.get()
    if not owner:
        return DB_PATH
    return DATA_DIR / f"careervault-{owner}.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS vaults (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,            -- 库名，如「我的经历库」「张伟的经历库」
    owner      TEXT DEFAULT '',          -- 为谁建的（我 / 朋友名字），仅作组织信息
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiences (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id   INTEGER DEFAULT 0,        -- 归属的经历库；0 表示待回填（迁移时补成默认库）
    type       TEXT NOT NULL,            -- 实习 / 项目 / 校园 / 科研 / 教育 / 技能
    title      TEXT NOT NULL,
    org        TEXT DEFAULT '',
    date_range TEXT DEFAULT '',
    tags       TEXT DEFAULT '[]',        -- JSON 数组字符串
    star_s     TEXT DEFAULT '',          -- 经历级「主线 STAR」：整段经历的背景
    star_t     TEXT DEFAULT '',          --                      整体职责 / 目标
    star_a     TEXT DEFAULT '',          --                      总体行动概括
    star_r     TEXT DEFAULT '',          --                      整体成果（可量化）
    tasks      TEXT DEFAULT '[]',        -- JSON 数组：这段经历下的若干独立任务，每个任务各自带 S/T/A/R
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resumes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_id   INTEGER DEFAULT 0,        -- 简历也归属经历库：给朋友生成的简历不该混进自己的列表
    title      TEXT NOT NULL,
    jd         TEXT DEFAULT '',          -- 生成时针对的岗位 JD
    content    TEXT NOT NULL,            -- 结构化简历 JSON（可在线编辑）
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 回收站：删除一个经历库是"删掉一整个人的资料"，属于最重的操作。
-- 有了这张表，界面上才敢做「一键删除」——删除只把整库快照搬到这里，
-- 数据其实还在本机，撤销 / 事后找回都只是把快照原样插回去。
CREATE TABLE IF NOT EXISTS vault_trash (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_name  TEXT NOT NULL,           -- 删掉时叫什么名字（快照里也有，这里是冗余的列表展示用）
    owner       TEXT DEFAULT '',
    snapshot    TEXT NOT NULL,           -- JSON：{vault, experiences[], resumes[]} 原样行数据
    experiences INTEGER DEFAULT 0,       -- 库内经历数（列表展示用，避免每次解析快照）
    resumes     INTEGER DEFAULT 0,
    deleted_at  TEXT NOT NULL
);
"""


def _ensure_schema(path: Path) -> None:
    """确保这个库文件已建表、已迁移、有默认经历库。

    每个设备一个库文件 → 不能只在进程启动时建一次表，得在第一次碰到
    某个库文件时补齐。进程内用 `_initialized` 缓存，之后零开销。
    """
    key = str(path)
    if key in _initialized:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        ensure_default_vault(conn)
        normalize_info_storage(conn)
        conn.commit()
    finally:
        conn.close()
    _initialized.add(key)


@contextmanager
def get_db():
    path = db_path()
    _ensure_schema(path)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


# 后加的列都登记在这里：SQLite 的 CREATE TABLE IF NOT EXISTS 不会给老库补列，
# 必须显式 ALTER。每条为 (表名, 列名, 列定义)。
MIGRATIONS: list[tuple[str, str, str]] = [
    ("experiences", "tasks", "TEXT DEFAULT '[]'"),
    ("experiences", "vault_id", "INTEGER DEFAULT 0"),
    ("resumes", "vault_id", "INTEGER DEFAULT 0"),
]


def _migrate(conn: sqlite3.Connection) -> None:
    for table, column, ddl in MIGRATIONS:
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if cols and column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def ensure_default_vault(conn: sqlite3.Connection) -> int:
    """保证至少存在一个经历库，并把「没有归属」的老数据收进默认库。

    这是 vault 迁移的关键一步：老库里的经历/简历 vault_id 是 0（ALTER 出来的默认值），
    不回填的话用户在界面上会一条都看不到。
    """
    row = conn.execute("SELECT id FROM vaults ORDER BY id LIMIT 1").fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO vaults (name, owner, created_at) VALUES (?, ?, ?)",
            (DEFAULT_VAULT_NAME, "我", datetime.now().isoformat(timespec="seconds")),
        )
        row = conn.execute("SELECT id FROM vaults ORDER BY id LIMIT 1").fetchone()
    vid = int(row["id"])
    for table in ("experiences", "resumes"):
        conn.execute(
            f"UPDATE {table} SET vault_id = ? WHERE vault_id IS NULL OR vault_id = 0",
            (vid,),
        )
    return vid


def init_db():
    """初始化**当前请求上下文**对应的库（本机模式即默认库）。

    main.py 启动时调用一次，保证默认库就绪；线上各设备的库由 get_db()
    在首次使用时经 _ensure_schema 懒初始化。
    """
    _ensure_schema(db_path())


def normalize_info_storage(conn: sqlite3.Connection) -> tuple[int, int]:
    """把老数据里「教育 / 技能」的分条修正过来，返回 (经历数, 简历数)。

    幂等：经历只处理"还是一整段（没有换行）但能断成多条"的行；简历只处理
    "分条结构与规则不一致"的板块。补的只是换行与条目边界，**不增删任何字符**，
    内容与原文逐字一致——分条规则见 api/infolines.py。
    """
    exp_fixed = 0
    rows = conn.execute(
        "SELECT id, star_a FROM experiences WHERE type IN ('教育', '技能')"
    ).fetchall()
    for r in rows:
        raw = r["star_a"] or ""
        if "\n" in raw:
            continue
        lines = split_info_lines(raw)
        if len(lines) > 1:
            conn.execute(
                "UPDATE experiences SET star_a = ? WHERE id = ?",
                ("\n".join(lines), r["id"]),
            )
            exp_fixed += 1

    resume_fixed = 0
    for r in conn.execute("SELECT id, content FROM resumes").fetchall():
        try:
            content = json.loads(r["content"] or "{}")
        except (TypeError, ValueError):
            continue
        if normalize_sections(content.get("sections")):
            conn.execute(
                "UPDATE resumes SET content = ? WHERE id = ?",
                (json.dumps(content, ensure_ascii=False), r["id"]),
            )
            resume_fixed += 1
    return exp_fixed, resume_fixed


def row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d["tags"] or "[]")
    # tasks 只存在于 experiences 表；其它表的行没有这一列，取不到就给空数组
    d["tasks"] = json.loads(d.get("tasks") or "[]")
    return d
