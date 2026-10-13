"""生职迹 Career Trail · 后端 API
FastAPI + SQLite，提供经历的增删查接口与 AI 能力（STAR 提炼 / JD 匹配）。

启动方式（在项目根目录 careervault/ 下）：
    ./.venv/bin/uvicorn api.main:app --reload --port 8000

线上部署（单端口同时服务前端静态页与 /api）：
    PORT=8000 python3 -m uvicorn api.main:app --host 0.0.0.0 --port $PORT
    前端产物构建到 webapp/ 后，本模块自动把它挂成站点根（见文件末尾）。
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .ai import router as ai_router
from .backup import router as backup_router
from .db import get_db, init_db, row_to_dict, set_owner
from .export import router as export_router
from .importer import router as import_router
from .models import ExperienceIn, ExpTaskIn, ExpType
from .resumes import router as resumes_router
from .tasks import normalize_tasks
from .vaults import resolve_vault_id
from .vaults import router as vaults_router

# ---------------- 应用 ----------------
app = FastAPI(title="生职迹 Career Trail API", version="1.7.0")

# 开发阶段允许 vite dev server 跨域（生产用 vite proxy 或同源部署即可去掉）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:7100", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)
app.include_router(import_router)
app.include_router(resumes_router)
app.include_router(export_router)
app.include_router(backup_router)
app.include_router(vaults_router)


@app.middleware("http")
async def scope_owner(request: Request, call_next):
    """把请求头里的设备标识挂到请求上下文上。

    db 层（api/db.py::db_path）按这个标识选择该设备自己的 SQLite 文件，
    所以从这一行之后，本请求里所有的读写都只发生在「这个浏览器自己的库」里。
    本机开发不带这个请求头 → 标识为空 → 走默认库，行为与从前一致。
    """
    set_owner(request.headers.get("x-cv-owner", ""))
    return await call_next(request)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok"}


def _tasks_json(tasks: list[ExpTaskIn]) -> str:
    """任务列表入库前统一清洗（字段齐全、去空、限长限量）。"""
    return json.dumps(normalize_tasks([t.model_dump() for t in tasks]), ensure_ascii=False)


@app.get("/api/experiences")
def list_experiences(type: ExpType | None = None, vault_id: int | None = None):
    """列出某个经历库的经历；不传 vault_id 时用默认库（而不是返回所有人的数据）。"""
    with get_db() as conn:
        vid = resolve_vault_id(conn, vault_id)
        sql = "SELECT * FROM experiences WHERE vault_id = ?"
        params: list = [vid]
        if type:
            sql += " AND type = ?"
            params.append(type)
        sql += " ORDER BY created_at DESC"
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [row_to_dict(r) for r in rows]


@app.post("/api/experiences", status_code=201)
def create_experience(exp: ExperienceIn):
    with get_db() as conn:
        vid = resolve_vault_id(conn, exp.vault_id)
        cur = conn.execute(
            """INSERT INTO experiences
               (vault_id, type, title, org, date_range, tags, star_s, star_t, star_a, star_r, tasks, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                vid,
                exp.type, exp.title, exp.org, exp.date_range,
                json.dumps(exp.tags, ensure_ascii=False),
                exp.star_s, exp.star_t, exp.star_a, exp.star_r,
                _tasks_json(exp.tasks),
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        row = conn.execute("SELECT * FROM experiences WHERE id = ?", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)


@app.put("/api/experiences/{exp_id}")
def update_experience(exp_id: int, exp: ExperienceIn):
    with get_db() as conn:
        sets = """type = ?, title = ?, org = ?, date_range = ?, tags = ?,
                   star_s = ?, star_t = ?, star_a = ?, star_r = ?, tasks = ?"""
        params: list = [
            exp.type, exp.title, exp.org, exp.date_range,
            json.dumps(exp.tags, ensure_ascii=False),
            exp.star_s, exp.star_t, exp.star_a, exp.star_r,
            _tasks_json(exp.tasks),
        ]
        # 支持「把这条经历挪到另一个库」（界面上暂无入口，但接口保持完整）
        if exp.vault_id:
            sets += ", vault_id = ?"
            params.append(resolve_vault_id(conn, exp.vault_id))
        params.append(exp_id)
        cur = conn.execute(f"UPDATE experiences SET {sets} WHERE id = ?", tuple(params))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="经历不存在")
        row = conn.execute("SELECT * FROM experiences WHERE id = ?", (exp_id,)).fetchone()
    return row_to_dict(row)


@app.delete("/api/experiences/{exp_id}", status_code=204)
def delete_experience(exp_id: int):
    with get_db() as conn:
        cur = conn.execute("DELETE FROM experiences WHERE id = ?", (exp_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="经历不存在")


# ---------------- 前端静态站点（线上部署用） ----------------
# 前端 vite build 产物放在 webapp/（刻意不叫 dist：发布通道会把「构建产物」
# 目录排除在上传之外）。存在就把它挂成站点根，一个端口同时服务页面与 /api。
# API 路由在上面已全部注册，FastAPI 按注册顺序匹配，不会被这里的通配路由截走；
# 只有未命中 API 的 GET 才落到 SPA 兜底。
WEB_DIR = Path(__file__).resolve().parent.parent / "webapp"

if WEB_DIR.is_dir():
    if (WEB_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=WEB_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        # API 未命中时不该返回页面 —— 保持 404 语义，前端排查问题才不至于被糊一脸 HTML
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="接口不存在")
        # 白名单式防目录穿越：解析后必须仍在 webapp/ 里
        candidate = (WEB_DIR / full_path).resolve()
        inside = str(candidate).startswith(str(WEB_DIR.resolve()))
        if full_path and candidate.is_file() and inside:
            return FileResponse(candidate)
        # 其余路径一律回入口页：前端是单页应用，刷新任何位置都应打开应用
        return FileResponse(WEB_DIR / "index.html")
