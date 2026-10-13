/**
 * 教育 / 技能这类「条目式罗列」经历的分条规则（前端唯一真源）。
 *
 * 这两类经历的内容是**既成事实**：学校、学位、GPA、课程、证书、技能名……
 * 一个字都不该改，但**必须按原简历的分条展示**——原简历里
 * 「产品&数据分析：…」「英语：…」「其他：…」是三行，界面上就该是三行，
 * 而不是挤成一大段。这里只决定"在哪里断条"，不碰任何内容字符。
 *
 * 断条规则（与后端 api/infolines.py 一一对应，改一处必须改两处）：
 *   1) 硬换行处必断——导入时已按行存下来的，行就是条；
 *   2) 分号 / 句号处，只有当**后一段以新的小节标签开头**时才断
 *      （「…Stata；英语：CET-6…」断，「…PowerPoint；熟悉Questmobile…」不断）；
 *   3) 兜底：整段一个标签都没有时（如「Python、SQL；Wind、同花顺；Excel」），
 *      每个分句各算一条——没有标签可依，只能承认它们本来就是并列的几条。
 */

/** 教育 / 技能：条目式罗列，不拆任务、不做改写 */
export const INFO_TYPES = ["教育", "技能"] as const;

export function isInfoType(type: string | undefined | null): boolean {
  return !!type && (INFO_TYPES as readonly string[]).includes(type);
}

/** 片段是否以「小标签：」开头（如「核心课程：」「英语：」「获奖经历：」） */
export function startsWithLabel(s: string): boolean {
  return /^\s*[^：:，,。；;\n]{1,12}[:：]/.test(s);
}

const SEP_RE = /[；;。]+/;

/**
 * 单行文本 → 分条。保留原始分隔符：
 * 只在"该断"的地方换成条边界，其余分句连同它们原来的「；」「。」一起接回去，
 * 所以拼起来和原文逐字一致。
 */
function splitByLabels(text: string): string[] {
  const tokens = text.split(/([；;。]+)/);
  const lines: string[] = [];
  let cur = "";
  let sep = "";
  let hasLabel = false;
  for (const tk of tokens) {
    if (!tk) continue;
    if (SEP_RE.test(tk) && tk.replace(SEP_RE, "") === "") {
      sep += tk;
      continue;
    }
    const seg = tk.trim();
    if (!seg) continue;
    const label = startsWithLabel(seg);
    if (label) hasLabel = true;
    if (!cur) {
      cur = seg;
    } else if (label) {
      lines.push(cur);
      cur = seg;
    } else {
      cur += sep + seg; // 续句：分隔符原样接回，内容一字不差
    }
    sep = "";
  }
  if (cur) lines.push(cur);
  if (!hasLabel && lines.length === 1) {
    const all = text.split(SEP_RE).map((s) => s.trim()).filter(Boolean);
    if (all.length > 1) return all;
  }
  return lines;
}

/** 教育 / 技能原文 → 分条要点（内容不改，只断条） */
export function infoLines(text: string | undefined | null): string[] {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n");
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    out.push(...splitByLabels(t));
  }
  return out;
}

/** 规范化成"一行一条"的存储形态（导入、保存时用） */
export function infoText(text: string | undefined | null): string {
  return infoLines(text).join("\n");
}

/**
 * 教育 / 技能经历 → 分条内容。
 * 与后端 api/ai.py::_info_bullets 同一套优先级：star_a（原文）→ 任务名 → star_r。
 */
export function infoBullets(exp: {
  star_a?: string;
  star_r?: string;
  tasks?: { name?: string; star_a?: string }[];
}): string[] {
  const lines = infoLines(exp.star_a);
  if (lines.length) return lines;
  const fromTasks = (exp.tasks ?? []).map((t) => (t.name || t.star_a || "").trim()).filter(Boolean);
  if (fromTasks.length) return fromTasks;
  return infoLines(exp.star_r);
}
