/**
 * 任务（Task）的前端工具层。
 *
 * 与后端 `api/tasks.py` 的 `normalize_tasks` / `rollup` 保持同一套语义：
 * 云端模型返回的 tasks 可能是脏的（缺字段、空对象、超长），这里统一清洗；
 * 经历级的「主线 STAR」缺内容时，用任务汇总补上（只填空缺，不覆盖已有内容）。
 */
import type { ExpTask, ExperienceInput } from "@/types/experience";

export const TASK_KEYS = ["name", "star_s", "star_t", "star_a", "star_r"] as const;
export const STAR_KEYS = ["star_s", "star_t", "star_a", "star_r"] as const;

const TASK_NAME_MAX = 60;
const TASK_TEXT_MAX = 800;
const TASK_MAX = 12;

export const EMPTY_TASK: ExpTask = { name: "", star_s: "", star_t: "", star_a: "", star_r: "" };

export function newTask(name = ""): ExpTask {
  return { ...EMPTY_TASK, name };
}

/** 任务是否有内容（决定要不要入库 / 要不要渲染） */
export function taskHasContent(t: ExpTask): boolean {
  return TASK_KEYS.some((k) => (t[k] || "").trim() !== "");
}

/** 清洗任意来源的任务数组：补字段、去空、限长、限量 */
export function normalizeTasks(raw: unknown, limit = TASK_MAX): ExpTask[] {
  if (!Array.isArray(raw)) return [];
  const out: ExpTask[] = [];
  for (const item of raw) {
    if (!item) continue;
    // 容错：模型偶尔把 tasks 写成纯字符串数组，把字符串当作任务的动作描述
    const src: Record<string, unknown> =
      typeof item === "string" ? { star_a: item } : (item as Record<string, unknown>);
    const task = { ...EMPTY_TASK };
    for (const k of TASK_KEYS) task[k] = String(src[k] ?? "").trim();
    task.name = task.name.slice(0, TASK_NAME_MAX);
    for (const k of STAR_KEYS) task[k] = task[k].slice(0, TASK_TEXT_MAX);
    if (!taskHasContent(task)) continue;
    if (!task.name) task.name = deriveTaskName(task.star_a || task.star_r);
    out.push(task);
  }
  return out.slice(0, limit);
}

/** 没有小标题时，用动作描述的第一句顶上 */
export function deriveTaskName(text: string, limit = 18): string {
  const head = text.split(/[。；;，,！!？?\n]+/)[0]?.trim() ?? "";
  const cleaned = head.replace(/^(?:我|负责|参与|协助|独立|主导|牵头|主要|完成|跟进|配合)\s*/, "").trim();
  if (!cleaned) return "（待命名任务）";
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned;
}

/**
 * 由任务汇总出经历级「主线 STAR」。
 *
 * 单个任务 → 直接照搬（这段经历就这一件事）；
 * 多个任务 → 给共同的背景/目标与结果清单。
 * 刻意**不**把各任务的 A 罗列进 star_a——那正是本次要修掉的老毛病。
 */
export function rollupTasks(tasks: ExpTask[]): Partial<ExperienceInput> {
  if (tasks.length === 0) return {};
  if (tasks.length === 1) {
    const t = tasks[0];
    const out: Partial<ExperienceInput> = {};
    for (const k of STAR_KEYS) if (t[k]) out[k] = t[k];
    return out;
  }
  const first = (key: (typeof STAR_KEYS)[number]) => tasks.find((t) => t[key])?.[key] ?? "";
  return {
    star_s: first("star_s"),
    star_t: first("star_t") || tasks.map((t) => t.name).filter(Boolean).join("、").slice(0, 200),
    star_r: tasks.map((t) => t.star_r).filter(Boolean).join("；").slice(0, 500),
  };
}

/** 主线 STAR 缺什么就用任务汇总补什么（只填空缺，不覆盖已写好的内容） */
export function applyTaskRollup<T extends Partial<ExperienceInput>>(exp: T, tasks: ExpTask[]): T {
  const rolled = rollupTasks(tasks);
  for (const key of Object.keys(rolled) as (keyof ExperienceInput)[]) {
    const value = rolled[key];
    if (typeof value === "string" && value && !String(exp[key] ?? "").trim()) {
      (exp as Record<string, unknown>)[key] = value;
    }
  }
  return exp;
}

/** 任务 / 结果 的一句话预览，用于卡片摘要与列表 */
export function taskPreview(t: ExpTask): string {
  return t.star_r || t.star_a || t.star_t || t.star_s || "";
}
