"""文本规整规则 —— 唯一真源（前端对应 src/lib/ai.ts::withFullStop）。

为什么要有这一层：简历的每条要点都该是一个完整的句子。模型压缩语料时
习惯把句末的「。」省掉，读起来像被截断的半句话。这里统一补齐，规则只有一条：

  末尾已经是终止标点（。！？…）→ 原样返回
  末尾是逗号 / 分号 / 顿号这类停顿号 → 先清掉再补「。」
  其余情况 → 直接补「。」

刻意放在**生成**环节而不是导出环节：编辑器、预览、导出读的是同一份内容，
三处天然一致；若挪到导出再加工，在线看到的与导出的就会对不上。
"""
from __future__ import annotations

import re

# 终止标点：句号、问号、叹号、省略号（中英文都收）
_TERMINAL = re.compile(r"[。！？!?…]+$")
# 尾随停顿号：逗号 / 分号 / 顿号 / 冒号 / 间隔号 / 空格
_SOFT_TAIL = re.compile(r"[，,；;、：:·・\u3000 ]+$")


def with_full_stop(text: str) -> str:
    """给一句话补上句末的「。」；已有终止标点或空串则原样返回。"""
    t = str(text or "").strip()
    if not t:
        return t
    if _TERMINAL.search(t):
        return t
    return _SOFT_TAIL.sub("", t) + "。"


def fill_bullet_stops(texts: list[str]) -> list[str]:
    """批量补句号（要点数组）。"""
    return [with_full_stop(t) for t in texts]
