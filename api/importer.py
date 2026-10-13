"""生职迹 Career Trail · 简历导入

职责一：把 PDF / DOCX / TXT / MD 文件里的文字抽出来（这一步必须在 Python 端做）。
职责二：本地规则解析——按常见简历分节标题粗切，作为前端云端解析失败时的保底。

AI 主解析在前端：`src/lib/ai.ts` 拿这里的 `text` 去调 WorkBuddy 云服务大模型，
失败才回落到本模块的 `/parse-file`、`/parse-text`。用户确认后由 `/confirm` 批量入库。
"""
from __future__ import annotations

import io
import json
import re
from datetime import datetime

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from .db import get_db, row_to_dict
from .exp_types import TASK_TYPES, VALID_TYPES, is_campus_role
from .infolines import info_text, is_info_type
from .models import ExperienceIn
from .tasks import apply_rollup, is_bullet, normalize_tasks, task_from_line
from .vaults import resolve_vault_id

router = APIRouter(prefix="/api/import", tags=["import"])

# ---------------- 文件 → 纯文本 ----------------

def extract_text(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    elif ext == "docx":
        import docx

        doc = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs)
    elif ext in ("txt", "md", ""):
        text = content.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=400, detail=f"暂不支持的文件类型 .{ext}，请上传 PDF / DOCX / TXT")
    text = text.strip()
    if len(text) < 30:
        raise HTTPException(status_code=400, detail="没能从文件里提取到足够的文字，请检查文件或为图片型 PDF（可改用粘贴文本）")
    return text[:15000]  # 截断保护，避免超长简历撑爆 prompt


# ---------------- 文本 → 结构化经历 ----------------

def normalize_exp(raw: dict) -> dict:
    t = str(raw.get("type", "")).strip()
    if t not in VALID_TYPES:
        # 常见别名归一化
        alias = {"实习经历": "实习", "项目经历": "项目", "科研经历": "科研",
                 "校园经历": "校园", "校园活动": "校园", "学生工作": "校园", "社团经历": "校园",
                 "教育经历": "教育", "教育背景": "教育", "技能特长": "技能", "专业技能": "技能"}
        t = alias.get(t, "项目")
    tags = raw.get("tags") or []
    exp = {
        "type": t,
        "title": str(raw.get("title", "")).strip()[:100] or "未命名经历",
        "org": str(raw.get("org", "")).strip(),
        "date_range": str(raw.get("date_range", "")).strip(),
        "tags": [str(x).strip() for x in tags if str(x).strip()][:10],
        "star_s": str(raw.get("star_s", "")).strip(),
        "star_t": str(raw.get("star_t", "")).strip(),
        "star_a": str(raw.get("star_a", "")).strip(),
        "star_r": str(raw.get("star_r", "")).strip(),
    }
    # 学生工作被归成项目 / 实习的，纠回「校园」（与前端 src/lib/ai.ts 同一套关键词）
    if exp["type"] in ("项目", "实习") and is_campus_role(exp["title"], exp["org"]):
        exp["type"] = "校园"
        t = "校园"
    tasks = normalize_tasks(raw.get("tasks"))
    if tasks:
        # 经历级「主线 STAR」缺什么，就用任务汇总补上（只填空缺，不覆盖已有）
        apply_rollup(exp, tasks)
    exp["tasks"] = tasks
    if is_info_type(t):
        # 教育 / 技能：内容原样保留，但统一成"一行一条"，展示与导出才能分条
        exp["star_a"] = info_text(exp["star_a"])
    return exp


# ---------------- 文本 → 结构化经历（本地规则） ----------------


SECTION_HINTS = {
    "实习": ["实习经历", "工作经历", "实习"],
    "项目": ["项目经历", "项目经验", "项目"],
    "校园": ["校园经历", "校园活动", "学生工作", "社团经历", "社会实践", "校园"],
    "科研": ["科研经历", "学术研究", "科研", "论文"],
    "教育": ["教育经历", "教育背景", "教育"],
    "技能": ["技能", "专业技能", "技能特长", "自我评价"],
}
DATE_RE = re.compile(r"(20\d{2}[./年]?\d{0,2})\s*[-—–~至到]+\s*(20\d{2}[./年]?\d{0,2}|至今|现在)")


# 折行碎片阈值：PDF 常把一条要点折成多行，这种短残片应并回上一个任务，
# 而不是被当成一个新任务。
WRAP_FRAGMENT_LEN = 10


def _add_line(entry: dict, line: str) -> None:
    """把一条正文行挂到当前经历上。

    实习 / 项目 / 科研：**每一行都是一件不同的事 → 各自成为一个任务**。
    旧版在这里把所有行拼进 star_a，正是"整段实习变成 STAR 里的 A"的根因。
    教育 / 技能：本身是条目式罗列，**一行存一条**（换行分隔）——
    这样界面上和导出的 PDF / Word 里就是原简历那样的分条，
    而不是把「产品&数据分析：…」「英语：…」「其他：…」挤成一大段。
    """
    if entry["type"] not in TASK_TYPES:
        prev = str(entry["star_a"] or "")
        entry["star_a"] = (prev + "\n" + line if prev else line)[:1000]
        return

    tasks: list[dict] = entry["tasks"]
    if tasks and not is_bullet(line) and len(line) <= WRAP_FRAGMENT_LEN:
        # 明显是折行残片 → 并回上一个任务，别拆出一个半个字的任务
        tasks[-1]["star_a"] = (tasks[-1]["star_a"] + line)[:800]
        return

    task = task_from_line(line)
    if task["star_a"]:
        tasks.append(task)


def parse_local(text: str) -> list[dict]:
    """本地降级解析：按常见简历分节标题粗切，日期行视为条目起点。

    与旧版的关键区别：条目下的**每条要点会被拆成一个独立任务**，
    并尽量识别出各自的 S / T / R，而不是全部堆进 star_a。
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    entries: list[dict] = []
    current_type = "项目"
    current: dict | None = None
    for ln in lines:
        for t, hints in SECTION_HINTS.items():
            if any(ln == h or (ln.startswith(h) and len(ln) <= len(h) + 4) for h in hints):
                current_type = t
                break
        else:
            m = DATE_RE.search(ln)
            if m:
                if current:
                    entries.append(current)
                title = DATE_RE.sub("", ln).strip(" |·-—　")[:60] or "未命名经历"
                current = {"type": current_type, "title": title, "org": "",
                           "date_range": m.group(0), "tags": [], "tasks": [],
                           "star_s": "", "star_t": "", "star_a": "", "star_r": ""}
            elif current:
                _add_line(current, ln)
    if current:
        entries.append(current)
    return [normalize_exp(e) for e in entries]


# ---------------- 接口 ----------------

class TextIn(BaseModel):
    text: str


class ConfirmIn(BaseModel):
    experiences: list[ExperienceIn]
    vault_id: int | None = None


def _parse_response(text: str, with_text: bool = False) -> dict:
    """本地规则解析结果；`with_text` 时把原文一并返回，供前端调云端模型。"""
    exps = parse_local(text)
    resp: dict = {"experiences": exps, "engine": "local", "count": len(exps)}
    if with_text:
        resp["text"] = text
    return resp


@router.post("/parse-file")
async def parse_file(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="文件超过 10MB 上限")
    text = extract_text(file.filename or "", content)
    print(f"[import] 文件 {file.filename} 提取文本 {len(text)} 字")
    return _parse_response(text, with_text=True)


@router.post("/parse-text")
def parse_text(body: TextIn):
    if len(body.text.strip()) < 30:
        raise HTTPException(status_code=400, detail="文本太短，不像一份简历")
    return _parse_response(body.text[:15000])


@router.post("/confirm", status_code=201)
def confirm_import(body: ConfirmIn):
    """批量入库到指定经历库，按 (type, title, org) 去重：重复经历跳过并告知用户。

    去重只在**同一个库内**做——同一个人的两段相似经历才算重复；
    "我"和"朋友"各自有一份同名的实习是正常的，不该被误判成重复。
    """
    now = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        vid = resolve_vault_id(conn, body.vault_id)
        existing = {
            (r["type"], r["title"], r["org"])
            for r in conn.execute(
                "SELECT type, title, org FROM experiences WHERE vault_id = ?", (vid,)
            ).fetchall()
        }
        imported, skipped = 0, []
        for exp in body.experiences:
            key = (exp.type, exp.title, exp.org)
            if key in existing:
                skipped.append(exp.title)
                continue
            existing.add(key)  # 同批次内部也去重
            # 教育 / 技能统一成"一行一条"再入库：云端解析返回的常常是一大段，
            # 存下来之后界面上就是分条的（内容一字不改，只插入换行）
            star_a = info_text(exp.star_a) if is_info_type(exp.type) else exp.star_a
            conn.execute(
                """INSERT INTO experiences
                   (vault_id, type, title, org, date_range, tags, star_s, star_t, star_a, star_r, tasks, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    vid,
                    exp.type, exp.title, exp.org, exp.date_range,
                    json.dumps(exp.tags, ensure_ascii=False),
                    exp.star_s, exp.star_t, star_a, exp.star_r,
                    json.dumps(
                        normalize_tasks([t.model_dump() for t in exp.tasks]),
                        ensure_ascii=False,
                    ),
                    now,
                ),
            )
            imported += 1
        rows = conn.execute(
            "SELECT * FROM experiences WHERE vault_id = ? ORDER BY created_at DESC", (vid,)
        ).fetchall()
    return {"imported": imported, "skipped": len(skipped), "skipped_titles": skipped, "total": len(rows)}
