"""生职迹 Career Trail · 本地保底引擎

AI 主引擎已迁到前端：由 `src/lib/ai.ts` 直接调用 WorkBuddy 云服务大模型（免密钥）。
本模块只保留**本地规则引擎**，在云端不可用时兜底，保证产品流程在任何环境下都能跑通：

  - STAR 提炼：按句子特征启发式归类
  - JD 匹配：技能词典命中 + 标签加权 + 文本二元组重合度
  - 生成简历：按类型把经历拼装成板块结构
  - 面试追问：按 STAR 完整度与技能标签套用面试官常用追问模板

响应统一带 `engine` 字段，前端据此展示结果来源。
"""
from __future__ import annotations

import json
import re

from fastapi import APIRouter
from pydantic import BaseModel, Field

from .db import get_db, row_to_dict
from .infolines import split_info_lines
from .tasks import split_tasks
from .text_rules import with_full_stop
from .vaults import resolve_vault_id

router = APIRouter(prefix="/api/ai", tags=["ai"])

# ---------------- 本地降级引擎 ----------------
# 常见岗位技能词典，用于 JD 关键词命中与缺失技能提示
SKILL_DICT = [
    "SQL", "Python", "Excel", "SPSS", "Tableau", "Axure", "Figma", "Sketch",
    "数据分析", "需求分析", "用户研究", "用户访谈", "竞品分析", "原型设计",
    "A/B测试", "AB测试", "漏斗分析", "增长实验", "PRD", "项目管理", "跨部门协作",
    "机器学习", "深度学习", "统计学", "市场调研", "活动策划", "内容运营", "用户运营",
]


def _bigrams(text: str) -> set[str]:
    text = re.sub(r"\s+", "", text)
    return {text[i : i + 2] for i in range(len(text) - 1)} if len(text) > 1 else set()


def _tasks_of(exp: dict) -> list[dict]:
    """取出这段经历的任务列表（防御性：老数据可能是空的或格式不整）。"""
    tasks = exp.get("tasks") or []
    return [t for t in tasks if isinstance(t, dict) and any(str(t.get(k) or "") for k in t)]


def _exp_text(exp: dict) -> str:
    """用于匹配/缺失分析的全文：经历级字段 + 每个任务的名字与 STAR。"""
    base = " ".join(str(exp.get(k, "")) for k in ("title", "org", "star_s", "star_t", "star_a", "star_r"))
    tasks = " ".join(
        " ".join(str(t.get(k, "")) for k in ("name", "star_s", "star_t", "star_a", "star_r"))
        for t in _tasks_of(exp)
    )
    return f"{base} {tasks}".strip()


def star_local(description: str) -> dict:
    """本地 STAR 提炼：按句子特征启发式归类，并把描述拆成任务清单。"""
    sentences = [s.strip() for s in re.split(r"[。！？!?\n]+", description) if s.strip()]
    if len(sentences) <= 1:  # 用户没写句读，退而按逗号切分
        sentences = [s.strip() for s in re.split(r"[,，;；]", description) if s.strip()]
    s = t = a = r = ""
    for sent in sentences:
        if not r and (re.search(r"\d", sent) or re.search(r"提升|增长|下降|达成|获得|完成率", sent)):
            r = sent
        elif not s:
            s = sent
        elif not a and re.search(r"访谈|分析|设计|组织|搭建|负责|推动|调研|测试|开发", sent):
            a = sent
        elif not t:
            t = sent
        elif not a:
            a = sent
    if not t and len(sentences) >= 2:
        t, a = a, t or a
    return {
        "star_s": s or "（补充当时面临的背景与问题）",
        "star_t": t or "（补充你承担的具体目标）",
        "star_a": a or "（补充你采取的关键行动）",
        "star_r": r or "（补充可量化的结果，最好有数字）",
        # 任务清单：描述里有几行/几条要点就拆几件事；整段是一句话时只有一个任务
        "tasks": split_tasks(description),
    }


def match_local(jd: str, experiences: list[dict]) -> dict:
    """本地 JD 匹配：技能词典命中 + 标签加权 + 文本二元组重合度。"""
    jd_skills = {s for s in SKILL_DICT if s.lower() in jd.lower()}
    jd_grams = _bigrams(jd)
    results = []
    for exp in experiences:
        tags = [str(t) for t in exp.get("tags", [])]
        text = _exp_text(exp) + " " + " ".join(tags)
        tag_hits = [t for t in tags if t.lower() in jd.lower()]
        skill_hits = [s for s in jd_skills if s.lower() in text.lower()]
        grams = _bigrams(text)
        overlap = len(jd_grams & grams) / max(len(jd_grams), 1)
        score = min(99, round(len(tag_hits) * 20 + len(skill_hits) * 12 + overlap * 100))
        if score > 0:
            hits = list(dict.fromkeys(tag_hits + skill_hits))
            reason = f"命中关键词：{'、'.join(hits)}" if hits else "经历内容与 JD 有部分语义重合"
            results.append({
                "id": exp["id"], "title": exp["title"], "type": exp["type"],
                "org": exp.get("org", ""), "star_r": exp.get("star_r", ""),
                "score": score, "reason": reason,
            })
    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:5]
    all_text = " ".join(_exp_text(e) + " " + " ".join(e.get("tags", [])) for e in experiences)
    missing = [s for s in sorted(jd_skills) if s.lower() not in all_text.lower()]
    overall = round(sum(x["score"] for x in top[:3]) / 3) if top else 0
    return {"overall_score": min(overall, 99), "matched": top, "missing_skills": missing}


# ---------------- 接口 ----------------
class StarRequest(BaseModel):
    description: str = Field(min_length=1)
    type: str = "实习"


class MatchRequest(BaseModel):
    jd: str = Field(min_length=1)
    vault_id: int | None = None


@router.post("/star")
def ai_star(req: StarRequest):
    """本地保底：把口语描述按句子特征拆成 STAR 四段。"""
    return {**star_local(req.description), "engine": "local"}


@router.post("/match")
def ai_match(req: MatchRequest):
    """本地保底：技能词典 + 标签 + 文本重合度打分。"""
    with get_db() as conn:
        vid = resolve_vault_id(conn, req.vault_id)
        rows = conn.execute(
            "SELECT * FROM experiences WHERE vault_id = ? ORDER BY created_at DESC", (vid,)
        ).fetchall()
    experiences = [row_to_dict(r) for r in rows]
    if not experiences:
        return {"overall_score": 0, "matched": [], "missing_skills": [], "engine": "local",
                "hint": "经历库为空，先去「记录经历」录入几条吧"}
    return {**match_local(req.jd, experiences), "engine": "local"}


# ---------------- 生成完整简历（本地保底） ----------------
class GenerateRequest(BaseModel):
    jd: str = Field(min_length=1)
    experience_ids: list[int] | None = None  # 为空则用整个经历库
    vault_id: int | None = None


SECTION_ORDER = ["教育经历", "实习经历", "项目经历", "校园经历", "科研经历", "技能特长"]
TYPE_TO_SECTION = {
    "教育": "教育经历", "实习": "实习经历", "项目": "项目经历",
    "校园": "校园经历", "科研": "科研经历", "技能": "技能特长",
}


def _exp_bullets(e: dict) -> list[str]:
    """一条经历 → 简历要点。

    有任务清单时，**每个任务独立成一条要点**（"任务名：动作，结果"），
    这才是简历该有的颗粒度；没有任务时才退回经历级的 A / R。
    """
    bullets: list[str] = []
    for t in _tasks_of(e):
        a = str(t.get("star_a") or "").strip()
        r = str(t.get("star_r") or "").strip()
        # R 常常就是 A 的最后一个子句，别拼成"…缩短到 9 天，…缩短到 9 天"
        body = "，".join([a] + ([r] if r and r not in a else []))
        line = f"{t.get('name', '')}：{body}" if t.get("name") and body else (t.get("name") or body)
        if line.strip():
            bullets.append(line.strip())
    if not bullets:
        bullets = [b for b in (e.get("star_a", ""), e.get("star_r", "")) if b]
    return bullets


def _info_bullets(e: dict) -> list[str]:
    """教育 / 技能经历 → 简历要点：原样分条（不拆 tasks，它们的 star_a 就是条目罗列）。

    分条规则见 api/infolines.py：内容一字不改，只按原简历的小节断条
    （「产品&数据分析：…」「英语：…」「其他：…」各自成条）。
    """
    lines = split_info_lines(e.get("star_a", ""))
    if lines:
        return lines
    tasks = _tasks_of(e)
    if tasks:
        return [str(t.get("name") or "") for t in tasks if str(t.get("name") or "").strip()]
    return [b for b in (e.get("star_a", ""), e.get("star_r", "")) if b]


def generate_local(experiences: list[dict]) -> dict:
    """本地降级：按模板把经历拼装成简历结构。"""
    groups: dict[str, list[dict]] = {}
    for e in experiences:
        groups.setdefault(TYPE_TO_SECTION.get(e["type"], "项目经历"), []).append(e)
    sections = []
    for name in SECTION_ORDER:
        items = []
        for e in groups.get(name, []):
            is_info = name in ("教育经历", "技能特长")
            bullets = _info_bullets(e) if is_info else _exp_bullets(e)
            # 条目标题统一「组织 · 标题」（组织在前）：经典求职版式会把两段拆成
            # 机构居左 / 职位或学位居中，顺序反了版式就不成立
            org = str(e.get("org") or "").strip()
            title = str(e["title"]).strip()
            heading = " · ".join(x for x in (org, title) if x)
            # 条目标题与板块名相同（如"个人技能"），或技能板块下没有组织的泛标题，都不重复展示
            if heading == name or (name == "技能特长" and not org):
                heading = ""
            items.append({
                "heading": heading,
                "subheading": e.get("date_range", ""),
                # 要点以完整句收尾（前端 withFullStop 同一套规则）
                "bullets": [with_full_stop(b) for b in bullets] or ["（请补充这段经历的描述）"],
            })
        if items:
            sections.append({"name": name, "items": items})
    return {"title": "我的简历", "summary": "", "sections": sections}


@router.post("/generate-resume")
def generate_resume(req: GenerateRequest):
    with get_db() as conn:
        vid = resolve_vault_id(conn, req.vault_id)
        rows = conn.execute(
            "SELECT * FROM experiences WHERE vault_id = ? ORDER BY created_at DESC", (vid,)
        ).fetchall()
    experiences = [row_to_dict(r) for r in rows]
    if req.experience_ids:
        keep = set(req.experience_ids)
        experiences = [e for e in experiences if e["id"] in keep]
    if not experiences:
        return {"resume": generate_local([]), "engine": "local",
                "hint": "经历库为空，先录入或导入经历再生成简历"}
    return {"resume": generate_local(experiences), "engine": "local"}


# ---------------- 面试追问预测（本地保底） ----------------
class InterviewRequest(BaseModel):
    experience_ids: list[int] | None = None
    jd: str = ""
    vault_id: int | None = None


def _first_clause(text: str, limit: int = 24) -> str:
    """取一句话的前半段，用于拼进追问里，让问题显得"看过你的经历"。"""
    t = re.sub(r"\s+", "", text or "")
    for sep in ("；", "。", "，", "：", ";", ",", ":"):
        idx = t.find(sep)
        if 0 < idx <= limit:
            return t[:idx]
    return t[:limit]


def interview_local(experiences: list[dict], jd: str) -> list[dict]:
    """本地降级：按 STAR 完整度与技能标签，用面试官常用追问模板生成问题。"""
    questions: list[dict] = []
    jd_hint = _first_clause(jd, 16) if jd.strip() else ""
    # 教育 / 技能不是"可被追问的经历"（没人追问你的 GPA 是怎么独立完成的），
    # 优先拿实习/项目/科研来出题；库里只有教育/技能时才退回去用它们。
    interviewable = [e for e in experiences if e.get("type") in ("实习", "项目", "科研")]
    for e in (interviewable or experiences)[:3]:
        title = e.get("title", "这段经历")
        tags = [str(t) for t in e.get("tags", [])]
        skill = next((t for t in tags if t.upper() in {s.upper() for s in SKILL_DICT}), "")
        # 优先拿**任务级**素材提问：比整段经历的概括精确得多，问出来才像"看过你的经历"
        tasks = _tasks_of(e)
        focus = next((t for t in tasks if str(t.get("star_r") or "").strip()), None) or (tasks[0] if tasks else None)
        a_source = str(focus.get("star_a") or "") if focus else str(e.get("star_a") or "")
        a_clause = _first_clause(a_source)
        r_text = str((focus or e).get("star_r") or "")
        has_number = bool(re.search(r"\d", r_text))

        questions.append({
            "question": f"「{title}」里{a_clause + '，' if a_clause else ''}具体哪些是你独立完成的？",
            "why": "面试官在区分「你的个人贡献」和「团队成果」，这是最容易翻车的追问",
            "hint": "按「我做的判断 → 我推进的动作 → 我的交付物」回答，少用「我们」；团队部分明确说明边界",
            "experience_title": title,
        })
        if len(tasks) > 1:
            names = "、".join(str(t.get("name") or "") for t in tasks[:3] if t.get("name"))
            if names:
                questions.append({
                    "question": f"你在「{title}」里同时推进了 {names} 这几件事，优先级是怎么排的？",
                    "why": "多任务并行最容易暴露「只是打杂」还是「真的能扛事」，面试官借此判断你的判断力",
                    "hint": "讲清当时的资源与时间约束，以及排序依据（影响面 / 依赖关系 / 成本），并给出取舍的例子",
                    "experience_title": title,
                })
        if r_text and has_number:
            questions.append({
                "question": f"你说{r_text[:20]}，这个数字是怎么统计出来的？",
                "why": "验证结果的真实性与你的归因能力，随口报数字最容易被追问穿",
                "hint": "讲清口径（时间范围 / 基数 / 统计方式）和你在其中的作用，避免把团队结果说成自己的",
                "experience_title": title,
            })
        else:
            questions.append({
                "question": f"「{title}」这段经历最终产生了什么可量化的结果？",
                "why": "没有数字的结果很难被记住，面试官常借此判断你有没有结果意识",
                "hint": "从规模（覆盖多少人/多少数据）、增幅（提升了多少）、效率（节省多少时间）、排名四类里找",
                "experience_title": title,
            })
        if skill:
            questions.append({
                "question": f"你在这段经历里用到 {skill}，能讲讲具体的操作过程吗？",
                "why": "简历上的技能工具很容易被追问细节，用来验证「是否真的会」",
                "hint": "准备一个 30 秒的具体例子（怎么做的、遇到什么坑、怎么解决的）",
                "experience_title": title,
            })
        questions.append({
            "question": f"「{title}」中最难的部分是什么？如果重来一次你会怎么改？",
            "why": "考察反思深度和成长性，也是判断经历真实性的常见问法",
            "hint": "用「当时的判断 → 遇到的阻力 → 复盘后的新认知」结构，坦诚比完美加分",
            "experience_title": title,
        })
        if jd_hint:
            questions.append({
                "question": f"这段经历和我们这个岗位（{jd_hint}…）有什么关联？",
                "why": "考察你对该岗位的理解，以及经历迁移能力",
                "hint": "把经历里可迁移的能力（分析方法 / 协作方式 / 业务理解）对齐 JD 的要求逐条说",
                "experience_title": title,
            })
    return questions[:8]


@router.post("/interview")
def ai_interview(req: InterviewRequest):
    with get_db() as conn:
        vid = resolve_vault_id(conn, req.vault_id)
        rows = conn.execute(
            "SELECT * FROM experiences WHERE vault_id = ? ORDER BY created_at DESC", (vid,)
        ).fetchall()
    experiences = [row_to_dict(r) for r in rows]
    if req.experience_ids:
        keep = set(req.experience_ids)
        experiences = [e for e in experiences if e["id"] in keep]
    if not experiences:
        return {"questions": [], "engine": "local",
                "hint": "经历库为空，先录入或导入经历再预测追问"}
    return {"questions": interview_local(experiences, req.jd), "engine": "local"}
