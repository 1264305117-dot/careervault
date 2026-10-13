"""生职迹 Career Trail · 任务（Task）的拆分、清洗与汇总

一段经历（实习 / 项目 / 校园 / 科研）通常由**若干个彼此独立的任务**组成，
每个任务各有自己的 情境(S) / 目标(T) / 行动(A) / 结果(R)。

历史 bug：解析时把整段经历的所有要点合并成一个字符串塞进 `star_a`，
S/T/R 全部留空——简历上明明有背景、有数字、有多件不同的事，全被压成一段。

本模块集中共享逻辑（云端模型与本地规则引擎都走这里）：

  - `normalize_tasks`  把任意来源（云端模型 / 备份文件 / 前端）的任务数组清洗成统一结构
  - `task_from_line`   把简历里的一条要点行变成一个任务，并**保守地**标注 S/T/R
  - `normalize_exp_tasks`  归一化一条经历，含"经历级主线 STAR"的汇总
  - `rollup`           由任务汇总出经历级的「主线 STAR」，只填空缺、不覆盖已有内容

设计原则：本地规则只在原文里**明确出现**对应线索时才填某个字段，否则留空。
宁可留空让用户补，也不要再出现"所有内容都堆进 A"这种结果。
"""
from __future__ import annotations

import re

TASK_KEYS = ("name", "star_s", "star_t", "star_a", "star_r")
STAR_KEYS = ("star_s", "star_t", "star_a", "star_r")

# 项目符号前缀：• · ● - * 1. 1、 (1) 等，可叠加
_BULLET_CHARS = r"•·▪▫◦●○◆◇■□★☆※✓✔"
BULLET_PREFIX = re.compile(
    rf"^\s*(?:(?:[{_BULLET_CHARS}]|[-*+>]|\d{{1,2}}[.、)）]|[(（]\d{{1,2}}[)）])\s*)+"
)
# 子句切分：句号 / 分号 / 逗号 / 换行都算边界，行动与结果往往就藏在逗号两侧
CLAUSE_SPLIT = re.compile(r"[。；;，,！!？?\n]+")

# —— 线索词典（本地保底用，宁可漏判也不要错判）——
RESULT_RE = re.compile(
    r"\d|提升|提高|增长|上涨|翻倍|下降|降低|缩短|节省|节约|达成|超额|完成率|转化率|留存"
    r"|日活|月活|活跃|GMV|ROI|排名|第一|获奖|优秀|覆盖|渗透|营收|成本|效率"
)
TARGET_RE = re.compile(r"负责|承担|目标|旨在|为了|要求|任务|职责|主导|牵头|独立完成|跟进")
SITUATION_RE = re.compile(r"背景|当时|由于|因为|面对|面临|存在|痛点|问题|现状|起因|瓶颈|复盘")

# 任务名里没有信息量的前缀，做小标题时应剥掉
_NAME_LEAD = re.compile(r"^(?:我|负责|参与|协助|独立|主导|牵头|主要|完成|跟进|配合)\s*")
# 结果句里的"增幅动词"权重高于仅仅出现"增长/留存"这类名词
_RESULT_VERB = re.compile(r"提升|提高|增长|上涨|翻倍|下降|降低|缩短|节省|节约|达成|超额")


def is_bullet(line: str) -> bool:
    """这行是不是简历里的一个要点（本次"任务"的载体）。"""
    return bool(BULLET_PREFIX.match(line))


def task_name(text: str, limit: int = 18) -> str:
    """由要点原文推一个小标题：取首个子句、剥掉"负责/参与"这类前缀。"""
    clauses = [c.strip() for c in CLAUSE_SPLIT.split(text.strip()) if c.strip()]
    if not clauses:
        return "（待命名任务）"
    head = clauses[0]
    # 首句如果纯粹在交代背景（"由于…"/"面对…"），它做小标题没有信息量，改用下一句
    if SITUATION_RE.search(head) and len(clauses) > 1:
        head = clauses[1]
    head = _NAME_LEAD.sub("", head).strip().strip("：: 　")
    if len(head) > limit:
        head = head[:limit].rstrip() + "…"
    return head or "（待命名任务）"


def _result_score(clause: str) -> int:
    """一句话有多像"结果"。

    光出现"增长/留存"这类名词不算数（"增长复盘会"其实是行动），
    带数字才说明是量化的结果，带幅度动词 + 百分号的权重最高。
    """
    if not RESULT_RE.search(clause):
        return 0
    score = 1 + len(_RESULT_VERB.findall(clause))
    if re.search(r"\d", clause):
        score += 2
    if re.search(r"[%％]", clause):
        score += 1
    return score


def task_from_line(line: str) -> dict:
    """把一条要点行变成一个任务：A 保留完整叙述，S/T/R 从原文里挑子句标注。

    A 一定是非空的（保底是整行原文）——它是这个任务的完整事实，
    但**只属于这一个任务**，不再是整段经历的大杂烩。
    """
    text = BULLET_PREFIX.sub("", line).strip()
    task = {"name": task_name(text), "star_s": "", "star_t": "", "star_a": text, "star_r": ""}
    clauses = [c.strip() for c in CLAUSE_SPLIT.split(text) if c.strip()]
    if not clauses:
        return task

    # 结果：取"最像结果"的那一句；并列时取靠后的（结果通常落在句尾）
    best, best_score = "", 0
    for clause in clauses:
        score = _result_score(clause)
        if score > 0 and score >= best_score:
            best, best_score = clause, score
    task["star_r"] = best

    # 情境 / 目标：各取第一句命中线索的（且不与结果重复）
    for clause in clauses:
        if not task["star_s"] and clause != task["star_r"] and SITUATION_RE.search(clause):
            task["star_s"] = clause
        if not task["star_t"] and clause != task["star_r"] and TARGET_RE.search(clause):
            task["star_t"] = clause
    return task


def normalize_tasks(raw: object, limit: int = 12) -> list[dict]:
    """把任意来源的任务数组清洗成统一结构（字段齐全、去空、限长、限量）。"""
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw:
        if item is None or item == "":
            continue
        # 容错：偶尔会拿到纯字符串数组，把字符串当作任务的动作描述
        if not isinstance(item, dict):
            item = {"star_a": str(item)}
        task = {k: str(item.get(k) or "").strip() for k in TASK_KEYS}
        task["name"] = task["name"][:60]
        for k in STAR_KEYS:
            task[k] = task[k][:800]
        if not any(task.values()):
            continue
        if not task["name"]:
            task["name"] = task_name(task["star_a"] or task["star_r"])
        out.append(task)
    return out[:limit]


def rollup(tasks: list[dict]) -> dict:
    """由任务汇总出经历级的「主线 STAR」。

    只产出**汇总视角**的内容：单个任务时直接照搬（这段经历就这一件事），
    多个任务时给出共同的背景/目标与结果清单；
    刻意**不**把各任务的 A 罗列进 star_a——那正是本次要修掉的老毛病。
    """
    if not tasks:
        return {}
    if len(tasks) == 1:
        return {k: tasks[0][k] for k in STAR_KEYS if tasks[0].get(k)}

    def first(key: str) -> str:
        return next((t[key] for t in tasks if t.get(key)), "")

    return {
        "star_s": first("star_s"),
        "star_t": first("star_t") or "、".join(t["name"] for t in tasks if t.get("name"))[:200],
        "star_r": "；".join(t["star_r"] for t in tasks if t.get("star_r"))[:500],
    }


def apply_rollup(exp: dict, tasks: list[dict]) -> dict:
    """任务 → 主线 STAR 的汇总，**只填空缺**，不覆盖模型/用户已经写好的内容。"""
    for key, value in rollup(tasks).items():
        if not str(exp.get(key) or "").strip() and value:
            exp[key] = value
    return exp


def split_tasks(text: str) -> list[dict]:
    """把一段自由文本拆成任务列表（本地保底用）。

    有项目符号或换行 → 每行一个任务；整段是一句话 → 就一个任务。
    不做"按句号硬切"这种激进操作：一句话里说三件事仍然是同一件事。
    """
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if len(lines) > 1:
        return [task_from_line(ln) for ln in lines][:12]
    if lines and is_bullet(lines[0]):
        return [task_from_line(lines[0])]
    single = text.strip()
    if not single:
        return []
    return [{**task_from_line(single), "star_a": single}]
