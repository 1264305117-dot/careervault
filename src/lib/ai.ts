/**
 * CareerVault · 应用侧 AI 能力层
 *
 * 主引擎：WorkBuddy 云服务大模型（免密钥，前端直连 `cloud.llm`）。
 * 保底引擎：后端本地规则引擎（`/api/ai/*`、`/api/import/*`）。
 *
 * 每个能力都是「先试云端，失败即回落本地」，并把失败原因（`fallback_reason`）透给界面，
 * 让用户知道这次结果为什么不是大模型给的——降级必须可见、可解释。
 */
import { cloud } from "./cloud";
import type {
  Experience,
  ExpType,
  InterviewResult,
  MatchedItem,
  MatchResult,
  ParseResult,
  ResumeContent,
  ResumeItem,
  ResumeSection,
  StarResult,
} from "@/types/experience";
import { applyTaskRollup, normalizeTasks } from "./tasks";
import { infoLines, infoText, isInfoType } from "./infolines";
import { loadPreferredTemplate } from "./resume-templates";
import { withVault } from "./vaults";
import type { CloudOpenAIError } from "@tencent-ai/workbuddy-cloud-sdk";

// ---------------- 模型选择 ----------------

export const DEFAULT_MODEL = "auto";
const MODEL_KEY = "cv_llm_model";

export interface CloudModel {
  id: string;
  name: string;
}

let modelsCache: CloudModel[] = [];

export function selectedModel(): string {
  try {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setSelectedModel(id: string) {
  try {
    localStorage.setItem(MODEL_KEY, id);
  } catch {
    /* 隐私模式下 localStorage 不可用，忽略即可 */
  }
}

/** 拉取可用模型目录；`disabled` 的模型不作为候选项。 */
export async function listModels(force = false): Promise<CloudModel[]> {
  if (modelsCache.length && !force) return modelsCache;
  const list = await cloud.llm.models.list();
  modelsCache = list
    .filter((m) => m.disabled !== true)
    .map((m) => ({ id: m.id, name: m.name || m.id }));
  return modelsCache;
}

// ---------------- 可用性探测（避免离线时每次都白等一个超时） ----------------

export interface CloudAvailability {
  ok: boolean;
  reason: string;
  models: CloudModel[];
  at: number;
}

let availability: CloudAvailability | null = null;
const AVAIL_TTL = 60_000; // 判定为不可用后，60 秒内直接走本地，不再反复试探

export function cloudAvailability(): CloudAvailability | null {
  return availability;
}

export async function refreshCloudStatus(force = false): Promise<CloudAvailability> {
  const now = Date.now();
  if (!force && availability && now - availability.at < AVAIL_TTL) return availability;
  try {
    const models = await listModels(force);
    if (!models.length) {
      availability = { ok: false, reason: "云端模型目录为空，请联系管理员确认应用已开启模型", models: [], at: now };
      return availability;
    }
    availability = { ok: true, reason: "", models, at: now };
  } catch (e) {
    availability = { ok: false, reason: friendlyCloudError(e), models: [], at: now };
  }
  return availability;
}

// ---------------- 错误 ----------------

/** 我们自己的错误（超时 / 返回格式异常 / 已知不可用），与 SDK 的 CloudOpenAIError 区分开 */
export class CloudAiError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

/** 把底层异常翻译成用户能看懂、能行动的一句话。 */
export function friendlyCloudError(e: unknown): string {
  if (e instanceof CloudAiError) {
    if (e.code === "cv_timeout") return "云端模型响应超时，已用本地引擎兜底，可稍后重试";
    if (e.code === "cv_bad_json") return "云端模型返回的格式不符合预期，已用本地引擎兜底";
    if (e.code === "cv_unavailable") return e.message;
    return e.message || "云端模型调用失败";
  }
  const err = e as Partial<CloudOpenAIError> & { message?: string };
  const code = err?.error?.code ?? "";
  const upstream = err?.error?.message ?? err?.message ?? String(e);
  if (code.startsWith("request_")) return `云端模型拒绝了本次请求（${code}），换一个模型试试`;
  if (code.startsWith("auth_")) return `云服务不认当前访问来源（${code}），请通过本应用的正式域名访问`;
  if (code.startsWith("quota_")) return "云端模型额度已用尽或触发限流，请稍后重试";
  if (code.startsWith("gateway_") || code.startsWith("model_")) return "云端模型服务暂时不可用，请稍后重试";
  if (code.startsWith("internal_")) return "云端服务内部错误，请稍后重试";
  if (code) return `云端模型调用失败（${code}）`;
  if (/fetch|network|Failed to fetch/i.test(upstream)) return "无法连接云端模型（网络问题），请检查网络";
  return "云端模型调用失败，已回退到本地规则引擎";
}

// ---------------- 调用与 JSON 解析 ----------------

/** 从模型回复里取出第一个完整的 JSON 对象（容忍 ```json 围栏和前后解释文字）。 */
function firstJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const scope = fence ? fence[1].trim() : trimmed;
  const start = scope.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < scope.length; i++) {
    const ch = scope[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(scope.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * 长输出的模型有时会在 max tokens 处被截断，JSON 缺了尾巴。
 * 这里做「截断修复」：回退到最近一个完整成员的边界，再补全缺失的括号——
 * 宁可少最后一条数据，也不让整次调用白白降级到本地模板。
 */
function repairTruncatedJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const s = text.slice(start).replace(/```\s*$/, "").trimEnd();

  const closeStructure = (frag: string): string | null => {
    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (let i = 0; i < frag.length; i++) {
      const c = frag[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") stack.pop();
    }
    if (inStr) return null; // 字符串没闭合，调用方应先回退截断点
    let out = frag.replace(/[,:\s]+$/, "");
    while (stack.length) out += stack.pop();
    return out;
  };
  const tryParse = (frag: string): unknown => {
    const closed = closeStructure(frag);
    if (!closed) return null;
    try {
      return JSON.parse(closed);
    } catch {
      return null;
    }
  };

  // 情况一：截断在两个值之间，直接补全括号即可
  const direct = tryParse(s);
  if (direct !== null) return direct;

  // 情况二：截断在字符串内部，回退到最近一个完整成员边界
  let lastSafe = -1;
  let inStr = false;
  let esc = false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth > 0) lastSafe = i; // 内层结构刚闭合，是一个完整的成员边界
    } else if (c === "," && depth > 0) lastSafe = i - 1;
  }
  if (lastSafe > 0) {
    const repaired = tryParse(s.slice(0, lastSafe + 1));
    if (repaired !== null) return repaired;
  }
  return null;
}

/**
 * 调云端模型并返回解析好的 JSON。
 * 注意：云服务只支持流式，所以这里自己把 SSE 分片拼成完整文本再解析。
 */
export async function callCloudJson<T>(
  system: string,
  user: string,
  opts: { timeoutMs?: number; model?: string } = {},
): Promise<T> {
  if (availability && !availability.ok && Date.now() - availability.at < AVAIL_TTL) {
    throw new CloudAiError("cv_unavailable", availability.reason);
  }
  const model = opts.model || selectedModel();
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let text = "";
  try {
    const stream = cloud.llm.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      signal: controller.signal,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) text += delta;
    }
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) throw new CloudAiError("cv_timeout");
  const parsed = firstJsonObject(text) ?? repairTruncatedJson(text);
  if (parsed === null || typeof parsed !== "object") throw new CloudAiError("cv_bad_json");
  // 一次成功的调用说明云端是通的
  if (!availability?.ok) availability = { ok: true, reason: "", models: modelsCache, at: Date.now() };
  return parsed as T;
}

// ---------------- 后端保底调用 ----------------

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

function clampScore(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, n));
}

// ---------------- 提示词 ----------------

const STAR_SYSTEM =
  "你是资深求职辅导专家。把用户口语化的经历描述改写为「任务清单 + 主线 STAR」。" +
  "严格输出 JSON：" +
  '{"star_s": "", "star_t": "", "star_a": "", "star_r": "", ' +
  '"tasks": [{"name": "任务小标题(8-16字)", "star_s": "", "star_t": "", "star_a": "", "star_r": ""}]}。' +
  "关键规则：" +
  "① 描述里如果讲了**几件彼此不同的事**，就拆成 tasks 里的几条（每条 1-3 句话），不要把多件事揉进同一个 star_a；" +
  "整段只讲一件事时 tasks 只放一条。" +
  "② 每个任务独立判断 S/T/R：描述里没提到的字段就留空字符串，不要硬凑；" +
  "③ 星标级的 star_s/star_t/star_a/star_r 是对整段经历的**一句话概括**，不要罗列各条任务。" +
  "④ R 段尽量突出可量化结果；描述里缺数字时给出保守表述，不要编造数字；" +
  "⑤ 若描述属于教育 / 技能这类**既成事实**（学校、专业、学位、GPA、排名、课程、证书），" +
  "原样整理即可：不要改写措辞、不要重排语序、不要补充原文没有的信息。";

const MATCH_SYSTEM =
  "你是求职简历顾问。根据岗位 JD 和候选人的经历库，挑出最值得写进简历的经历。" +
  "注意：每条经历下的 tasks 是这段经历中**彼此独立的具体任务**，" +
  "判断相关度时以任务为单位（某个任务命中 JD 就足以让这段经历入选），" +
  "reason 要说清是哪个任务命中了 JD 的哪条要求。" +
  "严格输出 JSON：" +
  '{"overall_score": 0-99 整数, "matched": [{"id": 经历id, "score": 0-99, "reason": "一句话匹配理由"}], ' +
  '"missing_skills": ["JD 要求但经历库缺失的技能"]}。' +
  "matched 按相关度降序，最多 5 条；reason 要具体说明命中了 JD 的哪些要求。";

const GENERATE_SYSTEM =
  "你是资深简历顾问。基于候选人的经历库和目标岗位 JD，生成一份针对性简历。" +
  "严格输出 JSON：" +
  '{"title": "简历标题(含目标岗位)", "summary": "一句话职业概述", ' +
  '"sections": [{"name": "教育经历|实习经历|项目经历|校园经历|科研经历|技能特长", ' +
  '"items": [{"heading": "条目标题(组织 · 角色)", "subheading": "起止时间", ' +
  '"bullets": ["要点1", "要点2"]}]}]}。' +
  "要求：板块按 教育→实习→项目→校园→科研→技能 排序；每条经历 2-3 个要点；" +
  "**经历库里没有内容的板块一律不要输出**（例如科研经历下面没有任何条目，就整块省略，不要留一个空标题）；" +
  "如果某个条目的 heading 里「组织」这一段很长（超过 16 个字，如比赛/论文/项目的完整名称），" +
  "就把它原样完整写在 heading 里，不要为了排版把它截断或改写；" +
  "每条经历下的 tasks 是它的具体任务，写要点时**优先把任务级的事实展开成独立要点**" +
  "（一个任务一条，保留该任务自己的背景与数字），不要把几个任务压缩成一句话；" +
  "**教育经历与技能板块必须逐字沿用经历库里的原文**：学校、专业、学位、GPA、排名、起止时间、" +
  "课程、技能名一律原样照搬，不做改写、精简、归并或向 JD 措辞靠拢——学历是既成事实，改一个字就失真；" +
  "但这两类板块**必须按原文的小节分条**：原文里每个小节（如「核心课程：」「获奖经历：」「英语：」「其他：」）" +
  "单独成一条要点，一个小节就是一条，严禁把所有小节挤进同一条要点；" +
  "一个小节**内部**用分号/顿号并列的内容（如「产品&数据分析：Figma、Xmind；SQL、Excel」）必须留在同一条里，不要再往下拆；" +
  "其余板块的要点措辞可向 JD 关键词靠拢，但只使用经历库中真实存在的事实和数字，严禁编造；" +
  "技能板块汇总与 JD 相关的技能，技能名称照原文写法，不要替换成 JD 里的同义说法。" +
  "**每条要点、每个标题的开头都不能是标点符号**（逗号、句号、顿号、分号、引号、括号等一律不行），" +
  "写完自查一遍，开头是标点的要点把标点删掉或把句子重排；" +
  "**每条要点都要写成完整的句子，句末统一用「。」收尾**——不要以逗号或分号收尾，也不要整条没有标点。" +
  "输出尽量紧凑的 JSON（不要多余缩进和换行），一次输出完整内容。";

const INTERVIEW_SYSTEM =
  "你是资深面试官与求职教练。根据候选人的经历库（和可选的目标岗位 JD），" +
  "预测面试官最可能追问的问题，并给出可以直接照着准备的建议。" +
  '严格输出 JSON：{"questions": [{"question": "面试官会怎么问", "why": "这个问题在考察什么", ' +
  '"hint": "怎么回答，具体到可以照做", "experience_title": "关联的经历标题"}]}。' +
  "要求：问题必须指向经历中的真实细节（引用其中的事实、数字、技能），不要泛泛而谈；" +
  "每条经历下的 tasks 是它的具体任务，**优先针对单个任务提问**" +
  "（例如「增长模块需求迭代」这个任务里你具体做了什么、那个数字怎么来的），" +
  "对包含多个任务的经历，还要追问任务的优先级与取舍；" +
  "覆盖五类——个人贡献澄清、结果量化、方法细节、失败与反思、与岗位的关联；" +
  "共 6-8 个问题，按被问到的概率排降序。";

const PARSE_SYSTEM =
  "你是简历解析专家。从用户提供的简历文本中抽取所有经历，严格输出 JSON：" +
  '{"experiences": [{"type": "实习|项目|校园|科研|教育|技能 之一", ' +
  '"title": "经历标题，如：产品经理实习生 / 校园二手书平台", "org": "公司/学校/团队", ' +
  '"date_range": "起止时间", "tags": ["涉及的技能"], ' +
  // 经历级：整段经历的一句话概括（主线 STAR）
  '"star_s": "整段经历的整体背景(1句，无则留空)", "star_t": "整段经历的整体职责(1句，无则留空)", ' +
  '"star_a": "整段经历的总体行动概括(1句，无则留空)", "star_r": "整段经历的整体成果(保留原文数字，无则留空)", ' +
  // 任务级：这段经历下彼此独立的具体任务，各自带 STAR
  '"tasks": [{"name": "这个任务在做什么，8-16字小标题，如：增长模块需求迭代", ' +
  '"star_s": "该任务要解决的背景或问题(原文写了才填，否则留空)", ' +
  '"star_t": "该任务要达成的具体目标(原文写了才填，否则留空)", ' +
  '"star_a": "该任务下你具体做的工作，保留原文事实与数字", ' +
  '"star_r": "该任务产生的可量化结果，保留原文数字(无则留空)"}]}]}。' +
  "必须遵守的规则（按重要性排序）：" +
  "① 简历里一段实习/项目下的**每一条要点(bullet)通常就是一件独立的任务**，" +
  "必须拆成 tasks 里独立的一条；有几条要点就拆几个任务，" +
  "**严禁把整段经历的所有要点合并进同一个 star_a**。" +
  "只有当整段经历确实只讲了一件事时，tasks 才只有一条。" +
  "② 每个任务都要独立判断 S/T/A/R：原文明确交代了背景或目标，才填 star_s / star_t；" +
  "没交代的就留空，不要把行动内容硬塞进 S/T/R 凑数。star_a 只写这一个任务的动作，不跨任务混装。" +
  "③ 带数字、百分比、规模、排名、周期缩短、提升/增长等表述属于**结果**，放进该任务的 star_r。" +
  "④ 经历级的 star_s/star_t/star_a/star_r 是对整段经历的**一句话概括**，不要罗列各条要点。" +
  "⑤ 只输出简历中真实存在的内容，严禁编造数字或经历；教育背景也算一条教育经历；技能汇总为一条技能经历。" +
  "⑥ 即使文本顺序因排版错乱（如多栏 PDF），也请按语义归并到正确的经历与任务里。" +
  "⑦ **教育经历与技能经历的内容必须原样照抄**：学校、专业、学位、GPA、排名、课程、起止时间、" +
  "技能名一律沿用简历原文的写法，不要改写、精简、归并或润色；" +
  "这两类也不拆 tasks（它们本身就是条目式罗列），内容按**小节分行**写进 star_a——" +
  "「产品&数据分析：…」「英语：…」「其他：」这一级各占一行，一个小节内部用分号并列的内容留在同一行。" +
  "标题与机构名也保持原文（如「投资学（本科）」不要改写成「本科·投资学」）。" +
  "⑧ **类型判定**：在学校的**学生工作、职务、社团与学生组织**（团支书 / 班长 / 班委 / 学生会 / 团委 / " +
  "社团 / 协会 / 学生助理 / 校园大使 / 志愿者 / 创新创业中心 / 社会实践 等）一律算 `校园`，" +
  "不要算 `项目` 或 `实习`；简历里自带「校园经历 / 学生工作 / 社团经历」小节的也整段算 `校园`。" +
  "`项目` 只留给真正的项目与竞赛作品（科研课题算 `科研`）。";

// ---------------- 经历序列化 ----------------

/**
 * 序列化一条经历给模型看。
 *
 * 有 tasks 时一定带上——它们才是真正的事实来源：
 *   - 匹配（full=false）只带任务名 + 动作 + 结果，控制 prompt 体积；
 *   - 生成简历 / 面试追问（full=true）带完整任务级 STAR，让模型能引用任务自己的背景与数字。
 */
function briefOf(e: Experience, full = false) {
  const base = {
    id: e.id,
    type: e.type,
    title: e.title,
    org: e.org,
    date_range: e.date_range,
    tags: e.tags,
    star_a: e.star_a,
    star_r: e.star_r,
  };
  const tasks = e.tasks?.length
    ? {
        tasks: e.tasks.map((t) =>
          full ? t : { name: t.name, star_a: t.star_a, star_r: t.star_r },
        ),
      }
    : {};
  return full ? { ...base, ...tasks, star_s: e.star_s, star_t: e.star_t } : { ...base, ...tasks };
}

// ---------------- 四个 AI 能力 ----------------

/** STAR 提炼：输出「任务清单 + 主线 STAR」 */
export async function aiStar(description: string, type: string): Promise<StarResult> {
  try {
    const r = await callCloudJson<Record<string, unknown>>(
      STAR_SYSTEM,
      `经历类型：${type}\n口语描述：${description}`,
      { timeoutMs: 90_000 },
    );
    const keys = ["star_s", "star_t", "star_a", "star_r"] as const;
    if (keys.some((k) => typeof r[k] !== "string")) throw new CloudAiError("cv_bad_json");
    const result: StarResult = {
      star_s: String(r.star_s),
      star_t: String(r.star_t),
      star_a: String(r.star_a),
      star_r: String(r.star_r),
      tasks: normalizeTasks(r.tasks),
      engine: "llm",
    };
    // 模型偷懒时（只给了主线没拆任务）用主线兜一条，避免"任务清单"永远是空的
    if (!result.tasks.length && (result.star_a || result.star_r)) {
      result.tasks = normalizeTasks([
        { name: result.star_t || result.star_a, star_s: result.star_s, star_t: result.star_t, star_a: result.star_a, star_r: result.star_r },
      ]);
    }
    return result;
  } catch (e) {
    const local = await postJson<StarResult>("/api/ai/star", { description, type });
    return { ...local, engine: "local", fallback_reason: friendlyCloudError(e) };
  }
}

/**
 * 岗位匹配。
 *
 * vaultId 只在落地到本地保底引擎时用到——云端路径直接把 experiences 数组发给模型，
 * 不存在"读错库"的可能；而本地引擎要自己去库里读，必须告诉它读哪个库。
 */
export async function aiMatch(
  jd: string,
  experiences: Experience[],
  vaultId: number | null = null,
): Promise<MatchResult> {
  try {
    const r = await callCloudJson<{
      overall_score?: unknown;
      matched?: { id?: unknown; score?: unknown; reason?: unknown }[];
      missing_skills?: unknown[];
    }>(MATCH_SYSTEM, `岗位 JD：\n${jd}\n\n经历库：\n${JSON.stringify(experiences.map((e) => briefOf(e)))}`, {
      timeoutMs: 150_000,
    });
    if (!Array.isArray(r.matched)) throw new CloudAiError("cv_bad_json");
    const byId = new Map(experiences.map((e) => [e.id, e]));
    const matched: MatchedItem[] = [];
    for (const m of r.matched) {
      const e = byId.get(Number(m?.id));
      if (!e) continue;
      matched.push({
        id: e.id,
        title: e.title,
        type: e.type,
        org: e.org,
        star_r: e.star_r,
        score: clampScore(m?.score),
        reason: String(m?.reason ?? ""),
      });
    }
    return {
      overall_score: clampScore(r.overall_score),
      matched,
      missing_skills: (r.missing_skills ?? []).slice(0, 8).map(String),
      engine: "llm",
    };
  } catch (e) {
    const local = await postJson<MatchResult>("/api/ai/match", { jd, vault_id: vaultId });
    return { ...local, engine: "local", fallback_reason: friendlyCloudError(e) };
  }
}

// ---------------- 教育 / 技能的分条兜底 ----------------

/** 教育 / 技能板块的分条归一化（模型不可靠，这里确定性兜底）
 *
 * ① 每个条目先把自己的要点**接回一整段**，再按「小节标签」重新分条：
 *    模型常把同一个小节拆成好几条要点（「产品&数据分析：Figma、Xmind」/「SQL、Excel…」/「Vibe Coding」），
 *    接回去才和原简历一样"一个小节一条"；
 * ② 没有机构名的空标题条目并成一条，免得技能板块出现好几个空标题块。
 *
 * 分条规则本身在 @/lib/infolines，与后端 api/infolines.py 同一套，改一处必须改两处。
 */
function normalizeInfoSections<
  T extends { name: string; items: { heading: string; subheading: string; bullets: string[] }[] },
>(sections: T[]): T[] {
  return sections.map((s) => {
    if (!/教育|技能/.test(s.name)) return s;
    const items = s.items.map((it) => ({ ...it, bullets: infoLines(it.bullets.join("；")) }));
    const merged: typeof items = [];
    for (const it of items) {
      const anon = !it.heading.trim() && !it.subheading.trim();
      const last = merged[merged.length - 1];
      if (anon && last && !last.heading.trim() && !last.subheading.trim()) {
        last.bullets.push(...it.bullets);
      } else {
        merged.push({ ...it, bullets: [...it.bullets] });
      }
    }
    return { ...s, items: merged };
  });
}

/** 生成完整简历 */
export async function aiGenerateResume(
  jd: string,
  experienceIds: number[] | null,
  vaultId: number | null = null,
): Promise<{
  resume: ResumeContent;
  engine: "llm" | "local";
  fallback_reason?: string;
  hint?: string;
}> {
  try {
    const all = await fetchExperiencesForGenerate(vaultId);
    const pool = experienceIds?.length ? all.filter((e) => experienceIds.includes(e.id)) : all;
    if (!pool.length) {
      return {
        resume: blankResume(),
        engine: "local",
        hint: "经历库为空，先录入或导入经历再生成简历",
      };
    }
    const r = await callCloudJson<{
      title?: unknown;
      summary?: unknown;
      sections?: { name?: unknown; items?: { heading?: unknown; subheading?: unknown; bullets?: unknown[] }[] }[];
    }>(
      GENERATE_SYSTEM,
      `目标岗位 JD：\n${jd}\n\n候选人经历库：\n${JSON.stringify(pool.map((e) => briefOf(e, true)))}`,
      { timeoutMs: 300_000 },
    );
    if (!Array.isArray(r.sections)) throw new CloudAiError("cv_bad_json");
    const sections = dropEmptySections(
      normalizeInfoSections(
        r.sections
          .filter((s) => s && typeof s.name === "string" && s.name)
          .map((s) => ({
            name: String(s.name),
            items: (s.items ?? []).map((it) => ({
              heading: String(it?.heading ?? ""),
              subheading: String(it?.subheading ?? ""),
              bullets: (it?.bullets ?? []).map(String),
            })),
          })),
        // 条目标题与板块名完全相同时（如技能板块下来一条"个人技能"）删掉标题，免得页面上重复两遍；
        // 技能板块下不带「组织 ·」结构的泛标题同理
      ).map((s) => ({
        ...s,
        items: s.items.map((it) => {
          const h = it.heading.trim();
          const drop = h === s.name.trim() || (/技能/.test(s.name) && !h.includes("·"));
          return drop ? { ...it, heading: "" } : it;
        }),
      })),
    );
    return {
      resume: {
        ...blankResume(),
        title: String(r.title || "我的简历"),
        summary: String(r.summary || ""),
        sections: fillBulletStops(sections),
      },
      engine: "llm",
    };
  } catch (e) {
    const local = await postJson<{ resume: ResumeContent; engine: "llm" | "local"; hint?: string }>(
      "/api/ai/generate-resume",
      { jd, experience_ids: experienceIds, vault_id: vaultId },
    );
    // 本地引擎的分条已经对了，这里再跑一遍归一化只是为了让两条路径的结果形态完全一致
    return {
      ...local,
      resume: {
        ...local.resume,
        sections: fillBulletStops(dropEmptySections(normalizeInfoSections(local.resume.sections ?? []))),
      },
      engine: "local",
      fallback_reason: friendlyCloudError(e),
    };
  }
}

/**
 * 空白简历骨架。
 *
 * 带上 template / photo：模型只产出内容（title/summary/sections），
 * 版式是本地的事——沿用用户上次选的模板，新简历就不必每次重新挑版式。
 */
export function blankResume(): ResumeContent {
  return {
    title: "我的简历",
    summary: "",
    // 页头：第一行姓名、第二行联系方式（导出时排版用）；title 只是列表里的文件名
    name: "",
    contact: "",
    sections: [],
    template: loadPreferredTemplate(),
    photo: "",
  };
}

/** 一个条目是否有真实内容（标题 / 时间 / 要点任一非空） */
export function itemHasContent(it: ResumeItem): boolean {
  return Boolean(
    it.heading.trim() || it.subheading.trim() || it.bullets.some((b) => String(b).trim()),
  );
}

/** 一个板块是否值得出现在成品里：有名字，且至少有一个有内容的条目 */
export function sectionHasContent(sec: ResumeSection): boolean {
  return Boolean(sec.name.trim()) && sec.items.some(itemHasContent);
}

/**
 * 丢掉空板块。
 *
 * 模型有时会留下一个只有标题的板块（「科研经历」下面什么都没有），
 * 打印出来就是一个孤零零的标题；用户也可能把某个板块的条目全删了。
 * 成品预览与导出（api/export.py::output_sections）用的是同一条口径。
 */
export function dropEmptySections<T extends ResumeSection>(sections: T[]): T[] {
  return sections.filter(sectionHasContent);
}

/**
 * 句末标点规则 —— 要点必须写成完整的句子。
 *
 * 模型压缩语料时习惯把句末的「。」省掉，读起来像被截断的半句话。
 * 这里只做一件事：末尾没有终止标点就补上「。」；末尾是逗号 / 分号 / 顿号
 * 这类停顿号时，先把它们清掉再补，免得出现「，。」这样的叠标点。
 *
 * 后端 api/ai.py::with_full_stop 是同一套规则（改一处要改两处）。
 * 放在**生成**环节而不是导出环节：编辑器、预览、导出看到的是同一份内容，
 * 三处天然一致（导出再加工反而会让在线与导出对不上）。
 */
const TERMINAL_PUNCT = /[。！？!?…]+$/;
const SOFT_TAIL_PUNCT = /[，,；;、：:·・\u3000 ]+$/;

export function withFullStop(text: string): string {
  const t = String(text ?? "").trim();
  if (!t) return t;
  if (TERMINAL_PUNCT.test(t)) return t;
  return t.replace(SOFT_TAIL_PUNCT, "") + "。";
}

/** 给所有板块的要点补齐句末标点（标题、机构名、时间不碰）。 */
export function fillBulletStops<T extends ResumeSection>(sections: T[]): T[] {
  return sections.map((s) => ({
    ...s,
    items: s.items.map((it) => ({ ...it, bullets: it.bullets.map(withFullStop) })),
  }));
}

/** 本地读一次经历库（生成简历时要带完整 STAR 字段） */
async function fetchExperiencesForGenerate(vaultId: number | null): Promise<Experience[]> {
  const res = await fetch(withVault("/api/experiences", vaultId));
  if (!res.ok) throw new Error(`无法读取经历库（HTTP ${res.status}）`);
  return (await res.json()) as Experience[];
}

/** 面试追问预测 */
export async function aiInterview(
  experienceIds: number[],
  jd: string,
  vaultId: number | null = null,
): Promise<InterviewResult> {
  try {
    const all = await fetchExperiencesForGenerate(vaultId);
    const pool = experienceIds.length ? all.filter((e) => experienceIds.includes(e.id)) : all;
    if (!pool.length) {
      return { questions: [], engine: "local", hint: "经历库为空，先录入或导入经历再预测追问" };
    }
    const r = await callCloudJson<{ questions?: { question?: unknown; why?: unknown; hint?: unknown; experience_title?: unknown }[] }>(
      INTERVIEW_SYSTEM,
      `目标岗位 JD（可能为空）：\n${jd.trim() || "（未提供）"}\n\n候选人经历库：\n${JSON.stringify(pool.map((e) => briefOf(e, true)))}`,
      { timeoutMs: 180_000 },
    );
    if (!Array.isArray(r.questions)) throw new CloudAiError("cv_bad_json");
    const questions = r.questions
      .filter((q) => q && String(q.question ?? "").trim())
      .map((q) => ({
        question: String(q.question).trim(),
        why: String(q.why ?? "").trim(),
        hint: String(q.hint ?? "").trim(),
        experience_title: String(q.experience_title ?? "").trim(),
      }))
      .slice(0, 10);
    if (!questions.length) throw new CloudAiError("cv_bad_json");
    return { questions, engine: "llm" };
  } catch (e) {
    const local = await postJson<InterviewResult>("/api/ai/interview", {
      experience_ids: experienceIds,
      jd,
      vault_id: vaultId,
    });
    return { ...local, engine: "local", fallback_reason: friendlyCloudError(e) };
  }
}

// ---------------- 简历导入解析 ----------------

const VALID_TYPES: ExpType[] = ["实习", "项目", "校园", "科研", "教育", "技能"];
const TYPE_ALIAS: Record<string, ExpType> = {
  实习经历: "实习",
  项目经历: "项目",
  科研经历: "科研",
  校园经历: "校园",
  学生工作: "校园",
  社团经历: "校园",
  校园活动: "校园",
  社会实践: "校园",
  教育经历: "教育",
  教育背景: "教育",
  技能特长: "技能",
  专业技能: "技能",
};

/**
 * 校园职务的关键词（前端与后端 api/importer.py 同一套，改一处必须改两处）。
 *
 * 为什么要确定性纠偏：模型看到「2021级投资学2班团支书」这种标题，很容易
 * 归成 `项目`（因为它长得像"一段有产出的事情"）。可学生工作既不是实习也不是项目，
 * 单列「校园经历」才是简历上的正确落位，所以这里再做一道规则兜底。
 */
const CAMPUS_RE =
  /团支书|团干|团支部|班长|班委|学生会|研究生会|团委|学生工作|社团|协会|校园大使|学生助理|辅导员|志愿者|志愿服务|社会实践|创新创业中心|学生组织/;

function isCampusRole(exp: { title: string; org: string }): boolean {
  return CAMPUS_RE.test(`${exp.org} ${exp.title}`);
}

/** 与后端 `normalize_exp` 保持一致，保证两条路径产出的结构相同。 */
function normalizeExperiences(raw: unknown): ParseResult["experiences"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const rawType = String(x.type ?? "").trim();
      const type = VALID_TYPES.includes(rawType as ExpType)
        ? (rawType as ExpType)
        : (TYPE_ALIAS[rawType] ?? "项目");
      const tags = Array.isArray(x.tags) ? x.tags : [];
      const exp: ParseResult["experiences"][number] = {
        type,
        title: String(x.title ?? "").trim().slice(0, 100) || "未命名经历",
        org: String(x.org ?? "").trim(),
        date_range: String(x.date_range ?? "").trim(),
        tags: tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10),
        star_s: String(x.star_s ?? "").trim(),
        star_t: String(x.star_t ?? "").trim(),
        star_a: String(x.star_a ?? "").trim(),
        star_r: String(x.star_r ?? "").trim(),
        tasks: normalizeTasks(x.tasks),
      };
      // 学生工作被模型归成项目/实习的，纠回「校园」
      if ((exp.type === "项目" || exp.type === "实习") && isCampusRole(exp)) exp.type = "校园";
      // 经历级「主线 STAR」缺什么，就用任务汇总补上（只填空缺，不覆盖模型已写好的）
      if (exp.tasks.length) applyTaskRollup(exp, exp.tasks);
      // 教育 / 技能：内容一字不改，但统一成"一行一条"，展示与导出才能像原简历那样分条
      if (isInfoType(type)) exp.star_a = infoText(exp.star_a);
      return exp;
    });
}

async function parseByCloud(text: string): Promise<ParseResult> {
  try {
    const r = await callCloudJson<{ experiences?: unknown }>(PARSE_SYSTEM, `简历文本：\n${text}`, {
      timeoutMs: 180_000,
    });
    const experiences = normalizeExperiences(r.experiences);
    if (!experiences.length) throw new CloudAiError("cv_bad_json");
    return { experiences, engine: "llm", count: experiences.length };
  } catch (e) {
    const local = await postJson<ParseResult>("/api/import/parse-text", { text });
    return { ...local, engine: "local", fallback_reason: friendlyCloudError(e) };
  }
}

/** 上传文件：后端抽文本（PDF/DOCX 只能在服务端解析），前端再走云端结构化。 */
export async function aiParseFile(file: File): Promise<ParseResult> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/import/parse-file", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  const local = (await res.json()) as ParseResult & { text?: string };
  if (!local.text?.trim()) return { ...local, engine: "local" };
  return parseByCloud(local.text);
}

/** 粘贴文本：直接走云端结构化 */
export async function aiParseText(text: string): Promise<ParseResult> {
  return parseByCloud(text.slice(0, 15000));
}
