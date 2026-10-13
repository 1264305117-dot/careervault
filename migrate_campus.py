"""一次性迁移：把「校园职务」归到新的「校园」类型，并同步已存简历的板块。

规则（与 api/exp_types.py::is_campus_role 同一套关键词）：
  1) 类型还是 项目 / 实习，但标题或机构命中学生工作关键词（团支书 / 创新创业中心 …）
     → 改成「校园」；
  2) 已生成简历里对应的条目，从「项目经历」等板块挪进「校园经历」板块（条目本身一字不改）；
  3) 顺手清掉简历里的空板块 / 空条目（与 api/export.py::output_sections 同一口径）。

幂等：跑完再跑一次不会有任何改动。运行前请先备份数据库。
"""
from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api.exp_types import is_campus_role  # noqa: E402

# 默认迁移生产库；也可以 `python migrate_campus.py /tmp/xxx.db` 先拿副本试跑。
DB = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "data" / "careervault.db"

CAMPUS_SECTION = "校园经历"
SECTION_ORDER = ["教育经历", "实习经历", "项目经历", "校园经历", "科研经历", "技能特长"]


def norm(s: str) -> str:
    """去掉分隔符与空白，用于宽松比对。

    简历里的条目标题和历史生成的写法未必逐字一致
    （「2021级投资学2班 · 团支书」vs 经历标题「2021级投资学2班团支书」），
    去掉 `·` 与空格后才对得上。
    """
    return re.sub(r"[\s·・|]+", "", str(s or ""))


def rank(name: str) -> int:
    return SECTION_ORDER.index(name) if name in SECTION_ORDER else len(SECTION_ORDER)


def item_has_content(it: dict) -> bool:
    return bool(
        str(it.get("heading") or "").strip()
        or str(it.get("subheading") or "").strip()
        or any(str(b).strip() for b in (it.get("bullets") or []))
    )


def main() -> None:
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    changed_types = 0
    # 被改成「校园」的标题 / 机构，用于到简历里认领条目（宽松比对，见 norm()）
    markers: list[tuple[str, str]] = []

    # ---------- ① 经历类型 ----------
    for row in conn.execute("SELECT id, type, title, org FROM experiences").fetchall():
        if row["type"] in ("项目", "实习") and is_campus_role(row["title"], row["org"]):
            conn.execute("UPDATE experiences SET type = '校园' WHERE id = ?", (row["id"],))
            markers.append((str(row["title"] or ""), str(row["org"] or "")))
            changed_types += 1
            print(f"  类型：{row['type']} → 校园   {row['org']} · {row['title']}")

    def is_moved_heading(heading: str) -> bool:
        h = norm(heading)
        if not h:
            return False
        for title, org in markers:
            nt, no = norm(title), norm(org)
            if nt and nt in h:
                return True
            if len(no) >= 4 and no in h and any(ch in h for ch in "团支书班委学生会"):
                return True
        return False

    # ---------- ② 条目归位 + ③ 空板块清理 ----------
    moved_total = dropped_total = 0
    for row in conn.execute("SELECT id, title, content FROM resumes").fetchall():
        content = json.loads(row["content"])
        sections = content.get("sections") or []
        moved: list[dict] = []
        kept: list[dict] = []
        for sec in sections:
            if sec.get("name") in ("教育经历", "技能特长"):
                kept.append(sec)
                continue
            rest = []
            for it in sec.get("items") or []:
                if is_moved_heading(str(it.get("heading") or "")):
                    moved.append(it)
                else:
                    rest.append(it)
            kept.append({**sec, "items": rest})

        cleaned: list[dict] = []
        for sec in kept:
            items = [it for it in sec.get("items") or [] if item_has_content(it)]
            if str(sec.get("name") or "").strip() and items:
                cleaned.append({**sec, "items": items})
            elif sec.get("items") is not None and not items:
                dropped_total += 1
                print(f"  [{row['title']}] 删除空板块：{sec.get('name')}")

        if moved:
            sec = next((s for s in cleaned if s["name"] == CAMPUS_SECTION), None)
            if sec is None:
                sec = {"name": CAMPUS_SECTION, "items": []}
                pos = next(
                    (i for i, s in enumerate(cleaned) if rank(s["name"]) > rank(CAMPUS_SECTION)),
                    len(cleaned),
                )
                cleaned.insert(pos, sec)
            sec["items"] = moved + list(sec["items"])
            moved_total += len(moved)
            print(f"  [{row['title']}] 挪入「{CAMPUS_SECTION}」{len(moved)} 条：{[m.get('heading') for m in moved]}")

        if cleaned != sections:
            content["sections"] = cleaned
            conn.execute(
                "UPDATE resumes SET content = ? WHERE id = ?",
                (json.dumps(content, ensure_ascii=False), row["id"]),
            )
            print(f"  [{row['title']}] 已更新")
        else:
            print(f"  [{row['title']}] 无改动")

    conn.commit()
    print(f"\n完成：类型改动 {changed_types} 条，简历条目移动 {moved_total} 条，删除空板块 {dropped_total} 个")
    conn.close()


if __name__ == "__main__":
    main()
