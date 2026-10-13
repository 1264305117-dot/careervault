"""生职迹 Career Trail · 教育 / 技能的分条规则（后端唯一真源）

与前端 src/lib/infolines.ts 一一对应，改一处必须改两处。

这两类经历的内容是**既成事实**（学校、学位、GPA、课程、证书、技能名），
一个字都不改，但必须按原简历的分条展示：
「产品&数据分析：…」「英语：…」「其他：…」在原简历里是三行，
界面上、导出的 PDF / Word 里也该是三行，而不是挤成一大段。

断条规则：
  1) 硬换行处必断——导入时已按行存下来的，行就是条；
  2) 分号 / 句号处，只有当**后一段以新的小节标签开头**时才断；
  3) 兜底：整段一个标签都没有时，每个分句各算一条。
"""
from __future__ import annotations

import re

# 只有这两类按「条目」存储，不拆任务
INFO_TYPES = {"教育", "技能"}

_SEP_RE = re.compile(r"[；;。]+")
# 「小标签：」= 12 字以内的短前缀 + 冒号（如「核心课程：」「英语：」「其他：」）
_LABEL_RE = re.compile(r"^\s*[^：:，,。；;\n]{1,12}[:：]")


def is_info_type(t: str | None) -> bool:
    return bool(t) and str(t) in INFO_TYPES


def starts_with_label(s: str) -> bool:
    return bool(_LABEL_RE.match(s))


def _split_by_labels(text: str) -> list[str]:
    """单行文本 → 分条。保留原始分隔符，拼起来与原文逐字一致。"""
    tokens = re.split(r"([；;。]+)", text)  # 带捕获组：分隔符本身也留在序列里
    lines: list[str] = []
    cur = ""
    sep = ""
    has_label = False
    for tk in tokens:
        if not tk:
            continue
        if _SEP_RE.fullmatch(tk):
            sep += tk
            continue
        seg = tk.strip()
        if not seg:
            continue
        label = starts_with_label(seg)
        if label:
            has_label = True
        if not cur:
            cur = seg
        elif label:
            lines.append(cur)
            cur = seg
        else:
            cur += sep + seg  # 续句：分隔符原样接回
        sep = ""
    if cur:
        lines.append(cur)
    if not has_label and len(lines) == 1:
        all_segs = [s.strip() for s in _SEP_RE.split(text) if s.strip()]
        if len(all_segs) > 1:
            return all_segs
    return lines


def split_info_lines(text: str | None) -> list[str]:
    """教育 / 技能原文 → 分条要点（内容不改，只断条）。"""
    out: list[str] = []
    for line in str(text or "").replace("\r\n", "\n").split("\n"):
        t = line.strip()
        if t:
            out.extend(_split_by_labels(t))
    return out


def info_text(text: str | None) -> str:
    """规范化成"一行一条"的存储形态（导入、读写时用）。"""
    return "\n".join(split_info_lines(text))


_SECTION_RE = re.compile(r"教育|技能")


def normalize_sections(sections: object) -> bool:
    """就地修正简历内容里「教育 / 技能」板块的分条，返回是否有改动。

    与前端 src/lib/ai.ts::normalizeInfoSections 同一套逻辑（改一处必须改两处）：
      ① 条目内：把要点接回一整段再按小节重新分条——
         模型常把同一个小节拆成好几条（「产品&数据分析：Figma、Xmind」/「SQL、Excel…」/「Vibe Coding」），
         接回去才和原简历一样"一个小节一条"；
      ② 条目间：没有机构名的空标题条目并成一条，免得技能板块出现好几个空标题块。
    幂等：已经正确的内容再跑一次不会有任何改动。
    """
    if not isinstance(sections, list):
        return False
    changed = False
    for sec in sections:
        if not isinstance(sec, dict) or not _SECTION_RE.search(str(sec.get("name") or "")):
            continue
        items = sec.get("items")
        if not isinstance(items, list):
            continue
        new_items: list[dict] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            bullets = [str(b) for b in (it.get("bullets") or [])]
            fixed = split_info_lines("；".join(bullets))
            cur = dict(it, bullets=fixed)
            if fixed != bullets:
                changed = True
            heading = str(cur.get("heading") or "").strip()
            sub = str(cur.get("subheading") or "").strip()
            last = new_items[-1] if new_items else None
            if (
                not heading
                and not sub
                and last is not None
                and not str(last.get("heading") or "").strip()
                and not str(last.get("subheading") or "").strip()
            ):
                last["bullets"] = list(last.get("bullets") or []) + fixed
                changed = True
            else:
                new_items.append(cur)
        if new_items != items:
            sec["items"] = new_items
            changed = True
    return changed
