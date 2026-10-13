"""生职迹 Career Trail · 简历存储
生成后的简历存库，支持在线编辑（PUT 更新）与删除。

简历同样归属某个**经历库**：给朋友生成的简历不该出现在自己的简历列表里。
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, HTTPException

from .db import get_db
from .models import ResumeIn
from .vaults import resolve_vault_id

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _row_to_resume(row) -> dict:
    d = dict(row)
    d["content"] = json.loads(d["content"])
    return d


@router.get("")
def list_resumes(vault_id: int | None = None):
    """列表页只需要元信息，不返回完整 content"""
    with get_db() as conn:
        vid = resolve_vault_id(conn, vault_id)
        rows = conn.execute(
            "SELECT id, vault_id, title, created_at, updated_at FROM resumes"
            " WHERE vault_id = ? ORDER BY updated_at DESC",
            (vid,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/{resume_id}")
def get_resume(resume_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM resumes WHERE id = ?", (resume_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="简历不存在")
    return _row_to_resume(row)


@router.post("", status_code=201)
def create_resume(resume: ResumeIn):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        vid = resolve_vault_id(conn, resume.vault_id)
        cur = conn.execute(
            "INSERT INTO resumes (vault_id, title, jd, content, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (vid, resume.title, resume.jd, resume.content.model_dump_json(), now, now),
        )
        row = conn.execute("SELECT * FROM resumes WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_resume(row)


@router.put("/{resume_id}")
def update_resume(resume_id: int, resume: ResumeIn):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE resumes SET title = ?, jd = ?, content = ?, updated_at = ? WHERE id = ?",
            (resume.title, resume.jd, resume.content.model_dump_json(), now, resume_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="简历不存在")
        row = conn.execute("SELECT * FROM resumes WHERE id = ?", (resume_id,)).fetchone()
    return _row_to_resume(row)


@router.delete("/{resume_id}", status_code=204)
def delete_resume(resume_id: int):
    with get_db() as conn:
        cur = conn.execute("DELETE FROM resumes WHERE id = ?", (resume_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="简历不存在")


@router.post("/{resume_id}/duplicate", status_code=201)
def duplicate_resume(resume_id: int):
    """另存为副本：投不同岗位时基于同一份简历改一版，不覆盖原版。"""
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM resumes WHERE id = ?", (resume_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="简历不存在")
        title = f"{row['title']}（副本）"[:100]
        cur = conn.execute(
            "INSERT INTO resumes (vault_id, title, jd, content, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (row["vault_id"], title, row["jd"], row["content"], now, now),
        )
        new_row = conn.execute("SELECT * FROM resumes WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_resume(new_row)
