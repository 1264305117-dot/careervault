/**
 * 经历类型。
 *
 * 「校园」是独立一类：学生工作、社团、班委、校内的学生组织与职务
 * （团支书、班长、学生会、创新创业中心…）既不是实习也不是项目，
 * 单列一类才能让它们在简历里形成自己的「校园经历」板块。
 */
export type ExpType = "实习" | "项目" | "校园" | "科研" | "教育" | "技能";

export const EXP_TYPES: ExpType[] = ["实习", "项目", "校园", "科研", "教育", "技能"];

/**
 * Vault —— 经历库：**一个人的完整工作区**（他的经历 + 基于这些经历生成的简历）。
 *
 * 为什么要显式建模：用户有时会帮朋友建库（"我朋友要找工作，帮他梳理经历"）。
 * 如果全站只有一个隐含的库，朋友的经历会混进自己的经历里，
 * 导出的简历也分不清是谁的。切换经历库 = 切换「现在在看谁的数据」。
 */
export interface Vault {
  id: number;
  /** 库名，如「我的经历库」「张伟的经历库」 */
  name: string;
  /** 为谁建的（我 / 朋友名字），仅作组织信息 */
  owner: string;
  created_at: string;
  /** 该库下的经历 / 简历条数（由后端统计，用于切换器上显示） */
  experiences: number;
  resumes: number;
}

/**
 * 删除经历库的结果。
 *
 * 删除是**一键生效**的：后端在同一个事务里把整库快照搬进本机回收站，
 * 并回传 `trash_id`——前端的「撤销」就是拿这个 id 去 restore，
 * 所以撤销能还原到原 id、原内容，而不是"重新建一个长得像的库"。
 */
export interface VaultDeleteResult {
  trash_id: number;
  vault: Vault;
  /** 快照里带走的经历 / 简历条数，用于撤销条与提示文案 */
  experiences: number;
  resumes: number;
}

/** 回收站列表项（不含快照正文） */
export interface VaultTrashItem {
  id: number;
  vault_name: string;
  owner: string;
  experiences: number;
  resumes: number;
  deleted_at: string;
}

/**
 * ExpTask —— 一段经历下的一个**独立任务**，各自带自己的 STAR。
 *
 * 为什么需要它：简历里一段实习常常有 3-5 条要点，它们其实是彼此独立的任务，
 * 各有自己的情境（"新用户第三步流失严重"）与结果（"次日留存提升 15%"）。
 * 早期版本把这些要点全部拼接进经历的 star_a，导致"整段实习变成 STAR 里的 A"，
 * 既丢了每件事的背景与结果，也没法按任务做 JD 匹配和面试追问。
 */
export interface ExpTask {
  /** 任务小标题，如「增长模块需求迭代」 */
  name: string;
  star_s: string;
  star_t: string;
  star_a: string;
  star_r: string;
}

/**
 * 经历级 star_s/t/a/r 是这段经历的「主线 STAR」——整段经历的背景、
 * 整体职责、总体行动与整体成果（一句话概括）。具体事务拆在 tasks 里。
 */
export interface Experience {
  id: number;
  /** 归属的经历库 */
  vault_id: number;
  type: ExpType;
  title: string;
  org: string;
  date_range: string;
  tags: string[];
  star_s: string;
  star_t: string;
  star_a: string;
  star_r: string;
  tasks: ExpTask[];
  created_at: string;
}

/** 表单里不管理 vault_id（由当前选中的经历库决定），所以从输入类型里去掉 */
export type ExperienceInput = Omit<Experience, "id" | "created_at" | "vault_id">;

export interface StarResult {
  star_s: string;
  star_t: string;
  star_a: string;
  star_r: string;
  /** 提炼出的任务清单：一段描述里讲了几件事就有几条 */
  tasks: ExpTask[];
  engine: "llm" | "local";
  fallback_reason?: string; // 配置过 Key 但 LLM 失败时，告知用户降级原因
}

export interface MatchedItem {
  id: number;
  title: string;
  type: ExpType;
  org: string;
  star_r: string;
  score: number;
  reason: string;
}

export interface MatchResult {
  overall_score: number;
  matched: MatchedItem[];
  missing_skills: string[];
  engine: "llm" | "local";
  fallback_reason?: string;
  hint?: string;
}

export interface ParseResult {
  experiences: ExperienceInput[];
  engine: "llm" | "local";
  count: number;
  fallback_reason?: string;
  /** 后端抽出的简历原文，供前端调云端模型（仅文件解析接口返回） */
  text?: string;
}

// ---------------- 简历 ----------------
/** 版式模板标识；皮肤定义在 src/lib/resume-templates.ts（唯一真源） */
export type ResumeTemplate = "classic" | "band" | "timeline" | "bold" | "formal";

export interface ResumeItem {
  heading: string;
  subheading: string;
  bullets: string[];
}

export interface ResumeSection {
  name: string;
  items: ResumeItem[];
}

export interface ResumeContent {
  title: string;
  summary: string;
  sections: ResumeSection[];
  /**
   * 页头排版：第一行姓名、第二行联系方式（邮箱 · 手机号）。
   * `title` 只是简历在列表里的文件名，不再印在纸面上；
   * 老简历没有这两个字段时导出回落到 title。
   */
  name?: string;
  contact?: string;
  /** 版式模板；老简历没有这个字段时回落到 classic */
  template?: ResumeTemplate;
  /** 证件照：data URL（前端已压到 ~320px 的 JPEG），空串表示不放照片 */
  photo?: string;
}

export interface ResumeMeta {
  id: number;
  vault_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Resume extends ResumeMeta {
  jd: string;
  content: ResumeContent;
}

export interface GenerateResult {
  resume: ResumeContent;
  engine: "llm" | "local";
  fallback_reason?: string;
  hint?: string;
}

// ---------------- 面试追问预测 ----------------
export interface InterviewQuestion {
  question: string;
  why: string; // 考察点
  hint: string; // 准备建议
  experience_title: string;
}

export interface InterviewResult {
  questions: InterviewQuestion[];
  engine: "llm" | "local";
  fallback_reason?: string;
  hint?: string;
}

// ---------------- 数据备份 ----------------
export interface BackupStats {
  experiences: number;
  resumes: number;
  /** 经历库数量（自己的 + 帮朋友建的） */
  vaults: number;
  db_path: string;
  db_size: number;
  latest_experience_at: string;
  latest_resume_at: string;
  exported_at: string;
}

export interface BackupImportResult {
  imported_experiences: number;
  skipped_experiences: number;
  imported_resumes: number;
  skipped_resumes: number;
  total_experiences: number;
  total_resumes: number;
}

/**
 * 引擎来源的文案（唯一真源）。
 *
 * 只放文案，不放类名：视觉表达由 `@/components/cv` 的 <EngineBadge> 负责。
 * 历史版本的 `cls` 字段（写着 bg-blue-50 之类的类名）已删除——
 * 那正是"设计令牌没有集中管理"的典型症状。
 */
export const ENGINE_BADGE: Record<'llm' | 'local', { label: string; title: string }> = {
  llm: { label: '云端大模型', title: '由 WorkBuddy 云端大模型生成，无需自备 API Key' },
  local: { label: '本地保底', title: '云端不可用，已由本地规则引擎生成，仅供参考' },
};
