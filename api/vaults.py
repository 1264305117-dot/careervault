"""生职迹 Career Trail · 经历库（Vault）

一个 **经历库** 就是「一个人的完整工作区」：他的经历 + 基于这些经历生成的简历。

为什么要有这层：用户有时会帮朋友建库（"我朋友要找工作，帮他梳理一下"）。
如果全站只有一个隐含的库，朋友的经历会混进自己的库里，导出的简历也分不清是谁的。
所以库是可增删的实体，界面上切换库 = 切换「现在在看谁的数据」。

删除策略（v1.5.1 起）：
  - 界面上的删除是**一键生效**的，不再弹双重确认——但删除只是把整库快照搬进
    本机回收站（`vault_trash` 表），数据没有真正离开这台电脑。
  - 因此可以：底部撤销条点一下还原 / 事后在「数据备份」页里找回 / 彻底删除。
  - 永远至少保留一个库（删最后一个会被拒绝，否则界面没有落脚点）。
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, HTTPException

from .db import DEFAULT_VAULT_NAME, get_db
from .models import VaultIn

router = APIRouter(prefix="/api/vaults", tags=["vaults"])

# 回收站最多留这么多条记录，超出时丢最旧的（按删除时间）。
# 一个库的快照可能几百 KB（含证件照 data URL），不设上限会无限膨胀。
TRASH_KEEP = 20


def resolve_vault_id(conn, vault_id: int | None) -> int:
    """把请求里的 vault_id 归一成一个真实存在的库 id。

    传空 / 传了一个已被删掉的 id 时，回落到最早的库（默认库），
    而不是报错——用户删库后浏览器里可能还留着旧的 id。
    """
    if vault_id:
        row = conn.execute("SELECT id FROM vaults WHERE id = ?", (vault_id,)).fetchone()
        if row:
            return int(row["id"])
    row = conn.execute("SELECT id FROM vaults ORDER BY id LIMIT 1").fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="经历库不存在，请重启后端以初始化数据库")
    return int(row["id"])


def _vault_row(conn, vault_id: int) -> dict:
    row = conn.execute("SELECT * FROM vaults WHERE id = ?", (vault_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="经历库不存在")
    d = dict(row)
    d["experiences"] = conn.execute(
        "SELECT COUNT(*) c FROM experiences WHERE vault_id = ?", (vault_id,)
    ).fetchone()["c"]
    d["resumes"] = conn.execute(
        "SELECT COUNT(*) c FROM resumes WHERE vault_id = ?", (vault_id,)
    ).fetchone()["c"]
    return d


def _snapshot(conn, vault_id: int) -> dict:
    """把一个库的**全部行数据**原样抓成快照。

    刻意不做任何字段转换（tags / tasks / content 保持数据库里的 JSON 字符串），
    这样恢复就是把同一批字符串插回去，中间没有解析/再序列化的机会把数据改坏。
    """
    vault = conn.execute("SELECT * FROM vaults WHERE id = ?", (vault_id,)).fetchone()
    experiences = conn.execute(
        "SELECT * FROM experiences WHERE vault_id = ? ORDER BY id", (vault_id,)
    ).fetchall()
    resumes = conn.execute(
        "SELECT * FROM resumes WHERE vault_id = ? ORDER BY id", (vault_id,)
    ).fetchall()
    return {
        "vault": dict(vault) if vault else None,
        "experiences": [dict(r) for r in experiences],
        "resumes": [dict(r) for r in resumes],
    }


def _trash_row(row) -> dict:
    """回收站列表项（不含 snapshot 正文，列表用不到，也不该往列表接口里塞几百 KB）"""
    d = dict(row)
    d.pop("snapshot", None)
    return d


def _trim_trash(conn) -> None:
    conn.execute(
        "DELETE FROM vault_trash WHERE id NOT IN "
        "(SELECT id FROM vault_trash ORDER BY deleted_at DESC, id DESC LIMIT ?)",
        (TRASH_KEEP,),
    )


def _insert_rows(conn, snapshot: dict, vault_id: int) -> tuple[int, int]:
    """把快照里的经历与简历插回指定库，返回 (经历数, 简历数)。

    行 id 尽量沿用原来的（AUTOINCREMENT 不会复用 id，所以通常都空着），
    沿用不了就让它自增——内容比 id 重要，绝不因为 id 冲突而丢数据。
    """
    exp_added = res_added = 0
    used_exp = {r["id"] for r in conn.execute("SELECT id FROM experiences").fetchall()}
    for e in snapshot.get("experiences") or []:
        eid = int(e.get("id") or 0)
        keep_id = eid if eid and eid not in used_exp else None
        if keep_id:
            used_exp.add(keep_id)
        conn.execute(
            """INSERT INTO experiences
               (id, vault_id, type, title, org, date_range, tags, star_s, star_t, star_a, star_r, tasks, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                keep_id, vault_id, e.get("type", "项目"), e.get("title", ""), e.get("org", ""),
                e.get("date_range", ""), e.get("tags") or "[]",
                e.get("star_s", ""), e.get("star_t", ""), e.get("star_a", ""), e.get("star_r", ""),
                e.get("tasks") or "[]", e.get("created_at") or datetime.now().isoformat(timespec="seconds"),
            ),
        )
        exp_added += 1

    used_res = {r["id"] for r in conn.execute("SELECT id FROM resumes").fetchall()}
    for r in snapshot.get("resumes") or []:
        rid = int(r.get("id") or 0)
        keep_id = rid if rid and rid not in used_res else None
        if keep_id:
            used_res.add(keep_id)
        now = datetime.now().isoformat(timespec="seconds")
        conn.execute(
            "INSERT INTO resumes (id, vault_id, title, jd, content, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                keep_id, vault_id, r.get("title", ""), r.get("jd", ""), r.get("content") or "{}",
                r.get("created_at") or now, r.get("updated_at") or now,
            ),
        )
        res_added += 1
    return exp_added, res_added


# ---------------- 回收站 ----------------
# 注意：这几个路由必须写在 /{vault_id} 之前，否则 "trash" 会被当成 vault_id 去转 int。


@router.get("/trash")
def list_trash():
    """最近删除的经历库（新的在前）。"""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM vault_trash ORDER BY deleted_at DESC, id DESC"
        ).fetchall()
        return [_trash_row(r) for r in rows]


@router.delete("/trash", status_code=200)
def clear_trash():
    """清空回收站——这一步才真的把数据从磁盘上抹掉。"""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM vault_trash")
        return {"purged": cur.rowcount}


@router.post("/trash/{trash_id}/restore", status_code=201)
def restore_trash(trash_id: int):
    """一键找回：把回收站里的整库快照原样恢复（含其中的经历与简历）。"""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM vault_trash WHERE id = ?", (trash_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="回收站里没有这条记录")
        try:
            snapshot = json.loads(row["snapshot"])
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="回收站快照已损坏，无法恢复")

        v = snapshot.get("vault") or {}
        # 原 id 还空着就沿用（经历/简历的归属也跟着对齐），否则新建一个库
        want_id = int(v.get("id") or 0)
        taken = want_id and conn.execute(
            "SELECT id FROM vaults WHERE id = ?", (want_id,)
        ).fetchone()
        if want_id and not taken:
            conn.execute(
                "INSERT INTO vaults (id, name, owner, created_at) VALUES (?, ?, ?, ?)",
                (want_id, v.get("name") or row["vault_name"], v.get("owner") or row["owner"],
                 v.get("created_at") or datetime.now().isoformat(timespec="seconds")),
            )
            new_id = want_id
        else:
            cur = conn.execute(
                "INSERT INTO vaults (name, owner, created_at) VALUES (?, ?, ?)",
                (v.get("name") or row["vault_name"], v.get("owner") or row["owner"],
                 v.get("created_at") or datetime.now().isoformat(timespec="seconds")),
            )
            new_id = int(cur.lastrowid)

        exp_added, res_added = _insert_rows(conn, snapshot, new_id)
        conn.execute("DELETE FROM vault_trash WHERE id = ?", (trash_id,))
        out = _vault_row(conn, new_id)
        out["experiences"] = exp_added
        out["resumes"] = res_added
        return out


@router.delete("/trash/{trash_id}", status_code=204)
def purge_trash(trash_id: int):
    """彻底删除回收站里的一条——不可再恢复。"""
    with get_db() as conn:
        cur = conn.execute("DELETE FROM vault_trash WHERE id = ?", (trash_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="回收站里没有这条记录")


@router.get("")
def list_vaults():
    with get_db() as conn:
        ids = [r["id"] for r in conn.execute("SELECT id FROM vaults ORDER BY id").fetchall()]
        return [_vault_row(conn, vid) for vid in ids]


@router.post("", status_code=201)
def create_vault(body: VaultIn):
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO vaults (name, owner, created_at) VALUES (?, ?, ?)",
            (body.name.strip() or DEFAULT_VAULT_NAME, body.owner.strip(), now),
        )
        return _vault_row(conn, int(cur.lastrowid))


@router.put("/{vault_id}")
def update_vault(vault_id: int, body: VaultIn):
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE vaults SET name = ?, owner = ? WHERE id = ?",
            (body.name.strip() or DEFAULT_VAULT_NAME, body.owner.strip(), vault_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="经历库不存在")
        return _vault_row(conn, vault_id)


@router.delete("/{vault_id}", status_code=200)
def delete_vault(vault_id: int):
    """一键删除经历库：整个库（含经历与简历）搬进本机回收站。

    返回 `trash_id`，前端据此做「撤销」；仅剩一个库时拒绝（409）。
    """
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) c FROM vaults").fetchone()["c"]
        if total <= 1:
            raise HTTPException(
                status_code=409, detail="这是最后一个经历库，不能删除（可以先新建一个库再删）"
            )
        row = conn.execute("SELECT * FROM vaults WHERE id = ?", (vault_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="经历库不存在")

        snapshot = _snapshot(conn, vault_id)
        cur = conn.execute(
            """INSERT INTO vault_trash (vault_name, owner, snapshot, experiences, resumes, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                row["name"], row["owner"] or "",
                json.dumps(snapshot, ensure_ascii=False),
                len(snapshot["experiences"]), len(snapshot["resumes"]),
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        trash_id = int(cur.lastrowid)
        conn.execute("DELETE FROM experiences WHERE vault_id = ?", (vault_id,))
        conn.execute("DELETE FROM resumes WHERE vault_id = ?", (vault_id,))
        conn.execute("DELETE FROM vaults WHERE id = ?", (vault_id,))
        _trim_trash(conn)
        return {
            "trash_id": trash_id,
            "vault": dict(row),
            "experiences": len(snapshot["experiences"]),
            "resumes": len(snapshot["resumes"]),
        }
