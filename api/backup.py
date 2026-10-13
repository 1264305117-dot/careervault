"""生职迹 Career Trail · 数据备份
单机 SQLite 场景下用户最担心"数据丢了"，这里提供可自助的备份与恢复：
- GET  /api/backup/stats   数据统计（经历数 / 简历数 / 数据库文件信息）
- GET  /api/backup/export  导出全部数据为 JSON 文件（下载）
- POST /api/backup/import  从备份 JSON 恢复（合并模式，自动跳过重复项）
"""
from __future__ import annotations

import io
import json
import urllib.parse
from datetime import datetime

from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import StreamingResponse

from .db import DEFAULT_VAULT_NAME, db_path, get_db, init_db, row_to_dict
from .tasks import normalize_tasks

router = APIRouter(prefix="/api/backup", tags=["backup"])

# 1.1 起 experiences 带 tasks（任务级 STAR）
# 1.2 起带 vaults（经历库）与 vault_id；1.0 / 1.1 的老备份仍可导入（内容落到默认库）
BACKUP_VERSION = "1.2"


def _all_rows(table: str) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(f"SELECT * FROM {table} ORDER BY id").fetchall()
    out = []
    for r in rows:
        d = dict(r)
        if table == "experiences":
            d["tags"] = json.loads(d.get("tags") or "[]")
            d["tasks"] = json.loads(d.get("tasks") or "[]")
        elif table == "resumes":
            d["content"] = json.loads(d["content"])
        out.append(d)
    return out


@router.get("/stats")
def backup_stats():
    experiences = _all_rows("experiences")
    resumes = _all_rows("resumes")
    vaults = _all_rows("vaults")
    size = db_path().stat().st_size if db_path().exists() else 0
    latest_exp = max((e["created_at"] for e in experiences), default="")
    latest_resume = max((r["updated_at"] for r in resumes), default="")
    return {
        "experiences": len(experiences),
        "resumes": len(resumes),
        "vaults": len(vaults),
        "db_path": str(db_path()),
        "db_size": size,
        "latest_experience_at": latest_exp,
        "latest_resume_at": latest_resume,
        "exported_at": datetime.now().isoformat(timespec="seconds"),
    }


@router.get("/export")
def export_all():
    """把经历库（含经历与简历）打包成一份 JSON，浏览器直接下载。"""
    payload = {
        "app": "careervault",
        "version": BACKUP_VERSION,
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "vaults": _all_rows("vaults"),
        "experiences": _all_rows("experiences"),
        "resumes": _all_rows("resumes"),
    }
    data = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
    fname = f"careervault-backup-{datetime.now().strftime('%Y%m%d-%H%M')}.json"
    quoted = urllib.parse.quote(fname)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quoted}"},
    )


@router.post("/import")
def import_all(payload: dict = Body(...)):
    """从备份 JSON 恢复（合并模式）：

    - 经历库按**名字**合并（同名不新建），并建立 老 id → 新 id 的映射
    - 经历按 (库, type, title, org) 去重、简历按 (库, title, created_at) 去重，重复项跳过而不是覆盖
    - 1.0 / 1.1 的老备份里没有 vaults / vault_id，内容一律落到默认库
    """
    if not isinstance(payload, dict) or payload.get("app") != "careervault":
        raise HTTPException(status_code=400, detail="这不是生职迹的备份文件（缺少 app 标识）")

    experiences = payload.get("experiences") or []
    resumes = payload.get("resumes") or []
    if not isinstance(experiences, list) or not isinstance(resumes, list):
        raise HTTPException(status_code=400, detail="备份文件结构异常：experiences / resumes 应为数组")

    init_db()
    now = datetime.now().isoformat(timespec="seconds")
    exp_added = exp_skipped = 0
    res_added = res_skipped = 0

    with get_db() as conn:
        default_vid = conn.execute("SELECT id FROM vaults ORDER BY id LIMIT 1").fetchone()["id"]
        by_name = {
            r["name"]: int(r["id"]) for r in conn.execute("SELECT id, name FROM vaults").fetchall()
        }
        id_map: dict[int, int] = {}
        for v in payload.get("vaults") or []:
            if not isinstance(v, dict):
                continue
            name = str(v.get("name") or "").strip() or DEFAULT_VAULT_NAME
            if name in by_name:
                id_map[int(v.get("id") or 0)] = by_name[name]
                continue
            cur = conn.execute(
                "INSERT INTO vaults (name, owner, created_at) VALUES (?, ?, ?)",
                (name[:40], str(v.get("owner") or "")[:40], v.get("created_at") or now),
            )
            new_id = int(cur.lastrowid)
            by_name[name] = new_id
            id_map[int(v.get("id") or 0)] = new_id

        def target_vault(raw_vid: object) -> int:
            try:
                return id_map.get(int(raw_vid or 0), int(default_vid))
            except (TypeError, ValueError):
                return int(default_vid)

        existing_exp = {
            (r["vault_id"], r["type"], r["title"], r["org"])
            for r in conn.execute("SELECT vault_id, type, title, org FROM experiences").fetchall()
        }
        for e in experiences:
            if not isinstance(e, dict) or not e.get("title"):
                continue
            vid = target_vault(e.get("vault_id"))
            key = (vid, e.get("type", "项目"), e["title"], e.get("org", ""))
            if key in existing_exp:
                exp_skipped += 1
                continue
            existing_exp.add(key)
            tags = e.get("tags") or []
            conn.execute(
                """INSERT INTO experiences
                   (vault_id, type, title, org, date_range, tags, star_s, star_t, star_a, star_r, tasks, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    vid,
                    e.get("type", "项目"), str(e["title"])[:100], e.get("org", ""), e.get("date_range", ""),
                    json.dumps(tags if isinstance(tags, list) else [], ensure_ascii=False),
                    e.get("star_s", ""), e.get("star_t", ""), e.get("star_a", ""), e.get("star_r", ""),
                    # 老备份没有 tasks 字段 → 归一化成空数组，保证新旧备份都能导入
                    json.dumps(normalize_tasks(e.get("tasks")), ensure_ascii=False),
                    e.get("created_at") or now,
                ),
            )
            exp_added += 1

        existing_res = {
            (r["vault_id"], r["title"], r["created_at"])
            for r in conn.execute("SELECT vault_id, title, created_at FROM resumes").fetchall()
        }
        for r in resumes:
            if not isinstance(r, dict) or not r.get("title"):
                continue
            vid = target_vault(r.get("vault_id"))
            key = (vid, r["title"], r.get("created_at") or now)
            if key in existing_res:
                res_skipped += 1
                continue
            existing_res.add(key)
            content = r.get("content")
            if isinstance(content, dict):
                content = json.dumps(content, ensure_ascii=False)
            conn.execute(
                "INSERT INTO resumes (vault_id, title, jd, content, created_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, ?)",
                (
                    vid, str(r["title"])[:100], r.get("jd", ""), content or "{}",
                    r.get("created_at") or now, r.get("updated_at") or now,
                ),
            )
            res_added += 1

        total_exp = conn.execute("SELECT COUNT(*) c FROM experiences").fetchone()["c"]
        total_res = conn.execute("SELECT COUNT(*) c FROM resumes").fetchone()["c"]

    return {
        "imported_experiences": exp_added,
        "skipped_experiences": exp_skipped,
        "imported_resumes": res_added,
        "skipped_resumes": res_skipped,
        "total_experiences": total_exp,
        "total_resumes": total_res,
    }
