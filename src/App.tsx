import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Eye,
  FileDown,
  FilePlus2,
  FileText,
  FileUp,
  Image as ImageIcon,
  ListChecks,
  MessageCircleQuestion,
  Palette,
  Plus,
  Save,
  Sparkles,
  SquarePen,
  Target,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { EXP_TYPES } from "@/types/experience";
import type {
  Experience,
  ExperienceInput,
  ExpType,
  GenerateResult,
  MatchResult,
  ParseResult,
  Resume,
  ResumeContent,
  ResumeMeta,
  ResumeTemplate,
  Vault,
} from "@/types/experience";
import { BTN_ACCENT, BTN_GHOST, BTN_PRIMARY, CARD, INPUT, type ToastFn } from "@/lib/ui";
import {
  aiGenerateResume,
  aiMatch,
  aiParseFile,
  aiParseText,
  aiStar,
  blankResume,
  itemHasContent,
  sectionHasContent,
  withFullStop,
  refreshCloudStatus,
  selectedModel,
  setSelectedModel,
  type CloudModel,
} from "@/lib/ai";
import { loadPreferredTemplate, rememberTemplate, templateOf } from "@/lib/resume-templates";
import { infoBullets, infoText, isInfoType } from "@/lib/infolines";
import {
  deleteVault as deleteVaultApi,
  pickVault,
  restoreVaultTrash,
  saveVaultId,
  withVault,
} from "@/lib/vaults";
import { cloudHost } from "@/lib/cloud";
import { downloadFile } from "@/lib/download";
import { Sidebar, type AiEngineProps } from "@/components/layout/Sidebar";
import type { View } from "@/components/layout/nav";
import DashboardView from "@/views/DashboardView";
import InterviewView from "@/views/InterviewView";
import DataView from "@/views/DataView";
import LandingView from "@/views/LandingView";
import { AppShell } from "@/components/layout/AppShell";
import {
  Button,
  Card,
  ClayPanel,
  EngineBadge,
  PageHeader,
  PhotoField,
  SectionTitle,
  TaskEditor,
  TaskList,
  TemplatePicker,
  TypeBadge,
  UndoBar,
} from "@/components/cv";
import { cn } from "@/lib/utils";

/**
 * 应用外壳。
 *
 * UI 遵循 design-system（High-Fidelity Claymorphism，见 design-system/careervault/MASTER.md）：
 *   - 令牌唯一真源在 src/index.css 的 :root（RGB 通道值 + 四层阴影栈），由 tailwind.config.js 映射为 cv-* 语义类
 *   - 通用组件一律从 @/components/cv 引入（Button / Card / Field / Badge / Orb / Reveal …）
 *   - 糖果色强调（紫罗兰 #7C3AED + 热粉 #DB2777）+ 浮动黏土导航板 + Nunito/DM Sans 双字体
 *
 * 本文件只负责「状态编排 + 视图分发」；具体页面在 src/views 下。
 */

/**
 * 经历级「主线 STAR」：整段经历的一句话概括。
 * 具体做了什么、拿到什么结果，拆在下面的「任务清单」里，别往这里塞——
 * 早期版本正是把所有要点堆进 star_a，才有了"整段实习变成 A"的问题。
 */
const STAR_FIELDS = [
  { key: "star_s", label: "S · 情境", hint: "整段经历的整体背景" },
  { key: "star_t", label: "T · 任务", hint: "你整体承担什么职责" },
  { key: "star_a", label: "A · 行动", hint: "总体在做什么（一句话就够）" },
  { key: "star_r", label: "R · 结果", hint: "整体成果，最好有数字" },
] as const;

/**
 * 条目标题里的「机构」超过这个字数就该独占一行。
 *
 * 与后端 api/export.py 的 LONG_HEADING_LIMIT 必须保持一致（改一处改两处）：
 * 三段式条目行的首栏只有 1.15fr（PDF 里 0.36 幅宽 ≈ 64mm），10pt 中文一行约 18 字，
 * 再长就会折成两三行、把职位与日期挤在旁边 —— 比赛 / 论文 / 项目的完整名称正是这种情况。
 */
const LONG_HEADING_LIMIT = 16;

/**
 * 在线纸张的排版标尺 —— A4 @96dpi（1pt = 4/3 px）。
 *
 * 纸张按 A4 真实比例铺开：宽 794px（210mm），页边距左右 16mm / 上下 14mm，
 * 与 api/export.py 的页面设置逐项对应。字号也从 pt 换算过来（而不是随手取整），
 * 这样在线看到的换行位置、栏目节奏与导出文件基本一致 —— 所见即所得。
 */
const A4_PAGE_MIN_H = 1123;   // 297mm —— 纸张的最小高度，让编辑区看起来就是"一张 A4"
// 纸张宽度 794px（210mm）与内边距 16mm / 14mm 直接写在容器的类名里（见纸张区注释）
/** 页头姓名字号（pt → px）：center 17 / band 18 / left 17.5 / big 21 —— 同 export.py::name_size */
const NAME_PX: Record<string, number> = { center: 22.7, band: 24, left: 23.3, big: 28 };
/**
 * 正文标尺（pt → px）：条目标题 10pt → 13.3px、日期 8.5pt → 11.3px、
 * 栏目标题 11pt → 14.7px（big 12.5pt → 16.7px）。这几档直接写在对应元素的
 * 类名里；下面的常量供预览态与要点行使用（内联样式需要真实数字）。
 */
const BULLET_PX = 12.7;
const BULLET_LH_PX = 18.7;
const SECTION_TITLE_PX = 14.7;
const SECTION_TITLE_BIG_PX = 16.7;

/**
 * 成品预览里的一条要点 —— 与 api/export.py::bullet_markup 同一套规则：
 * 经典求职版式把开头的「前缀：」加粗（「AI 产品策略：参与…」），其余版式原样输出。
 * 编辑态是输入框、渲染不了局部加粗，所以「预览 = 导出」这条在预览态兑现。
 */
function renderBullet(text: string, formal: boolean) {
  const m = formal ? /^(.{1,16}?)[:：]\s*(.+)$/s.exec(text) : null;
  if (!m) return text;
  return (
    <>
      <b>{m[1]}：</b>
      {m[2]}
    </>
  );
}

const EMPTY_FORM: ExperienceInput = {
  type: "实习",
  title: "",
  org: "",
  date_range: "",
  tags: [],
  star_s: "",
  star_t: "",
  star_a: "",
  star_r: "",
  tasks: [],
};

const DEMO_JD = `【产品实习生】
职责：参与 C 端产品需求分析与功能设计，跟进功能上线与数据复盘；
要求：具备良好的数据分析能力（SQL 优先），有用户研究或 A/B 测试经验者加分；
逻辑清晰，有ownership，有完整项目经历者优先。`;

const JD_HISTORY_KEY = "cv_jd_history";

/**
 * 一条经历 → 简历要点。
 *
 * 教育 / 技能是条目式罗列：**原样分条**（学校、学位、课程、技能名一个字不改），
 * 有几条小节就是几条要点。
 *
 * 其余类型：有任务清单时**一个任务一条要点**（"任务名：动作，结果"），
 * 这才是简历该有的颗粒度；没有任务时才退回经历级的 A / R 两段（历史数据的形态）。
 */
function bulletsOf(exp: Experience): string[] {
  if (isInfoType(exp.type)) {
    const lines = infoBullets(exp);
    if (lines.length) return lines;
  }
  const fromTasks = (exp.tasks ?? [])
    .map((t) => {
      const a = (t.star_a ?? "").trim();
      const r = (t.star_r ?? "").trim();
      // R 常常就是 A 的最后一个子句，包含时不再重复拼一次
      const body = [a, r && !a.includes(r) ? r : ""].filter(Boolean).join("，");
      return t.name && body ? `${t.name}：${body}` : t.name || body;
    })
    .filter(Boolean);
  return fromTasks.length ? fromTasks : [exp.star_a, exp.star_r].filter(Boolean);
}

function loadJdHistory(): string[] {
  try {
    const raw = localStorage.getItem(JD_HISTORY_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// ---- 打开网址先看首页；进入应用后地址带上 #app，刷新/收藏仍留在应用里 ----
const APP_HASH = "#app";

/**
 * 只有地址里明确带 #app 才直接进应用，其余情况（直接打开网址、分享出去的链接、
 * 从搜索进站）一律先给产品首页 —— 门面就是这个 app 的第一印象。
 */
function startsInApp(): boolean {
  try {
    return location.hash === APP_HASH;
  } catch {
    return false;
  }
}

/** 把「在不在应用里」同步到地址栏：在应用内 = #app，回到首页 = 去掉 hash */
function syncAppHash(inApp: boolean): void {
  try {
    const base = `${location.pathname}${location.search}`;
    history.replaceState(null, "", inApp ? `${base}${APP_HASH}` : base);
  } catch {
    /* 极少数环境禁改历史：忽略。刷新后回到首页，不影响任何功能 */
  }
}

// ---------------- 轻量 Toast（替代原生 alert，不阻塞操作） ----------------
type ToastItem = { id: number; kind: "ok" | "err"; text: string };

function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  // 内容变化时自动增高，长要点不再被一行高度裁剪
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(resize, [props.value]);
  return <textarea {...props} ref={ref} rows={1} onInput={resize} />;
}

export default function App() {
  const [view, setView] = useState<View>(() => (startsInApp() ? "dashboard" : "landing"));
  const [experiences, setExperiences] = useState<Experience[]>([]);

  // ---- 经历库（Vault）：全站「现在在看谁的数据」的唯一上下文 ----
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [vaultId, setVaultId] = useState<number | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultsReady, setVaultsReady] = useState(false);
  /**
   * 刚被删掉的经历库（用于底部撤销条）。
   * 只记 trash_id 与展示信息——整库快照在服务端回收站里，不必塞进内存。
   */
  const [undoDelete, setUndoDelete] = useState<{
    trashId: number;
    name: string;
    experiences: number;
    resumes: number;
  } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  /** 当前经历库（界面上到处都要显示"现在在看谁的库"） */
  const currentVault = vaults.find((v) => v.id === vaultId) ?? null;

  const [form, setForm] = useState<ExperienceInput>(EMPTY_FORM);
  const [tagsText, setTagsText] = useState("");
  const [apiError, setApiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingExpId, setEditingExpId] = useState<number | null>(null); // 非空即编辑模式
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 云端 AI 引擎状态（免密钥）：可用性 + 可选模型
  const [aiStatus, setAiStatus] = useState<{ ok: boolean; reason: string } | null>(null);
  const [aiModels, setAiModels] = useState<CloudModel[]>([]);
  const [aiModel, setAiModel] = useState(selectedModel);
  const [aiChecking, setAiChecking] = useState(false);

  const checkAi = useCallback(async (force = false) => {
    setAiChecking(true);
    try {
      const a = await refreshCloudStatus(force);
      setAiModels(a.models);
      setAiStatus({ ok: a.ok, reason: a.reason });
      // 之前选的模型不在目录里了（下线/改名），切到第一个可用模型
      const cur = selectedModel();
      if (a.ok && a.models.length && !a.models.some((m) => m.id === cur)) {
        setSelectedModel(a.models[0].id);
        setAiModel(a.models[0].id);
      }
    } finally {
      setAiChecking(false);
    }
  }, []);

  // 启动时探测一次云端可用性，让界面上的引擎状态从一开始就是真的
  useEffect(() => {
    void checkAi();
  }, [checkAi]);

  const toast: ToastFn = useCallback((kind, text) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "ok" ? 3000 : 5000);
  }, []);

  // AI 提炼 STAR
  const [descText, setDescText] = useState("");
  const [starLoading, setStarLoading] = useState(false);
  const [starEngine, setStarEngine] = useState<"llm" | "local" | null>(null);
  const [starFallbackReason, setStarFallbackReason] = useState("");

  // 简历导入
  const [importFile, setImportFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI 岗位匹配
  const [jdText, setJdText] = useState("");
  const [jdHistory, setJdHistory] = useState<string[]>(loadJdHistory);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  function rememberJd(text: string) {
    const t = text.trim();
    if (!t) return;
    const next = [t, ...jdHistory.filter((x) => x !== t)].slice(0, 5);
    setJdHistory(next);
    try {
      localStorage.setItem(JD_HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* 隐私模式下写不了，忽略即可 */
    }
  }

  // 简历：生成、列表、在线编辑
  const [generating, setGenerating] = useState(false);
  const [resumeList, setResumeList] = useState<ResumeMeta[]>([]);
  const [editingResumeId, setEditingResumeId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ResumeContent | null>(null);
  const [resumeJd, setResumeJd] = useState("");
  const [resumeSaving, setResumeSaving] = useState(false);
  const [savedJson, setSavedJson] = useState(""); // 上次保存时的快照，用于未保存检测
  /** 编辑器：成品预览模式（隐藏所有编辑装饰，只看版式效果） */
  const [preview, setPreview] = useState(false);

  // AI 等待计时：让用户确信"没卡死"（匹配 20-60s / 导入 1-2min / 生成 2-4min）
  const [elapsed, setElapsed] = useState(0);
  const aiWorking = starLoading || parseLoading || matchLoading || generating;
  useEffect(() => {
    if (!aiWorking) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [aiWorking]);

  /** 拉一次经历库列表，并把当前库对齐到一个真实存在的 id 上 */
  const loadVaults = useCallback(async () => {
    try {
      const res = await fetch("/api/vaults");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list: Vault[] = await res.json();
      setVaults(list);
      setVaultId((prev) => {
        const next = prev && list.some((v) => v.id === prev) ? prev : (pickVault(list)?.id ?? null);
        if (next) saveVaultId(next);
        return next;
      });
    } catch {
      /* 静默：连不上后端时下面的 load() 会给出统一的错误提示 */
    } finally {
      setVaultsReady(true);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withVault("/api/experiences", vaultId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setExperiences(await res.json());
      setApiError("");
    } catch {
      setApiError("连不上后端：请确认已运行 ./.venv/bin/uvicorn api.main:app --port 8000");
    }
  }, [vaultId]);

  useEffect(() => {
    void loadVaults();
  }, [loadVaults]);

  // 等经历库列表就绪后再拉经历：否则会先用"默认库"请求一次，
  // 与"用户上次选的朋友库"的请求竞争，可能闪出别人的/自己的数据
  useEffect(() => {
    if (vaultsReady) void load();
  }, [vaultsReady, load]);

  /** 切换经历库：数据（经历 / 简历 / 匹配）全跟着走 */
  function switchVault(id: number) {
    if (id === vaultId) return;
    setVaultBusy(true);
    setVaultId(id);
    saveVaultId(id);
    const target = vaults.find((v) => v.id === id);
    if (target) toast("ok", `已切换到「${target.name}」`);
    // 让"切换中"至少可见一瞬，避免本来很快的切换闪一下反而像故障
    setTimeout(() => setVaultBusy(false), 400);
  }

  async function createVault() {
    const who = prompt("给谁建经历库？\n填名字（例如：张伟）；给你自己建就直接填「我」", "张伟");
    if (who === null) return;
    const owner = who.trim().slice(0, 40);
    if (!owner) {
      toast("err", "填个名字吧，方便区分是给谁建的");
      return;
    }
    const name = owner === "我" || owner === "自己" ? "我的经历库" : `${owner}的经历库`;
    try {
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, owner }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: Vault = await res.json();
      await loadVaults();
      switchVault(created.id);
      setView("dashboard");
      toast("ok", `已新建「${created.name}」。现在导入的就是 TA 的经历，不会混进你自己的库`);
    } catch {
      toast("err", "新建经历库失败：后端没连上");
    }
  }

  async function renameVault(v: Vault) {
    const name = prompt("重命名经历库", v.name);
    if (name === null || !name.trim() || name.trim() === v.name) return;
    try {
      const res = await fetch(`/api/vaults/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim().slice(0, 40), owner: v.owner }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadVaults();
      toast("ok", "已重命名");
    } catch {
      toast("err", "重命名失败：后端没连上");
    }
  }

  /**
   * 一键删除经历库。
   *
   * 刻意**不弹确认框**：删一个库是"清理帮朋友建完的库"这类高频动作，
   * 每次弹两级 confirm 会把顺手的事变成负担。敢这么做的前提是数据没真丢——
   * 后端在同一个事务里把整库快照写进了本机回收站，并回了 trash_id：
   *   · 十秒内：底部撤销条一键还原
   *   · 十秒后：数据备份页的回收站照样能找回
   * 删掉的如果正是当前库，loadVaults 会把当前库回落到剩下的第一个库，
   * 随后的 load / loadResumes 会自动跟着新 vaultId 重新拉数据。
   */
  async function removeVault(v: Vault) {
    try {
      const res = await deleteVaultApi(v.id);
      setUndoDelete({
        trashId: res.trash_id,
        name: res.vault.name,
        experiences: res.experiences,
        resumes: res.resumes,
      });
      await loadVaults();
    } catch (e) {
      toast("err", `删除失败：${e instanceof Error ? e.message : "后端没连上"}`);
    }
  }

  /** 撤销删除：把回收站里的整库快照原样恢复，并切回那个库 */
  async function undoRemoveVault() {
    if (!undoDelete) return;
    setUndoBusy(true);
    try {
      const back = await restoreVaultTrash(undoDelete.trashId);
      setUndoDelete(null);
      await loadVaults();
      saveVaultId(back.id);
      setVaultId(back.id);
      toast("ok", `已恢复「${back.name}」（${back.experiences} 段经历 · ${back.resumes} 份简历）`);
    } catch (e) {
      toast("err", `撤销失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setUndoBusy(false);
    }
  }

  function resetExpForm() {
    setForm(EMPTY_FORM);
    setTagsText("");
    setDescText("");
    setStarEngine(null);
    setStarFallbackReason("");
    setEditingExpId(null);
  }

  /**
   * 退出「记录 / 编辑经历」。
   * 空白表单直接走；已经写了东西再退出就问一句，免得手一抖丢掉刚写的内容。
   */
  function cancelExpForm() {
    const touched = Boolean(
      form.title.trim() ||
        form.org.trim() ||
        form.date_range.trim() ||
        form.tags.length ||
        form.star_s ||
        form.star_t ||
        form.star_a ||
        form.star_r ||
        form.tasks.some((t) => t.name || t.star_s || t.star_t || t.star_a || t.star_r),
    );
    if (touched && !confirm("这段经历还没保存，确定放弃吗？")) return;
    resetExpForm();
    setView("dashboard");
  }

  function startAdd() {
    resetExpForm();
    setView("add");
  }

  function startEditExp(e: Experience) {
    setEditingExpId(e.id);
    setForm({
      type: e.type,
      title: e.title,
      org: e.org,
      date_range: e.date_range,
      tags: e.tags,
      star_s: e.star_s,
      star_t: e.star_t,
      // 教育 / 技能：打开就按"一行一条"显示（老数据存的是一整段，这里补上换行）
      star_a: isInfoType(e.type) ? infoText(e.star_a) : e.star_a,
      star_r: e.star_r,
      tasks: e.tasks ?? [],
    });
    setTagsText(e.tags.join(", "));
    setDescText("");
    setStarEngine(null);
    setStarFallbackReason("");
    setView("add");
  }

  async function save() {
    if (!form.title.trim()) {
      toast("err", "至少填个标题吧");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        // 新建时落到当前经历库；编辑时后端保留原归属（这里带上也无害）
        vault_id: vaultId,
        tags: tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
      };
      const isEdit = editingExpId !== null;
      const res = await fetch(isEdit ? `/api/experiences/${editingExpId}` : "/api/experiences", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      resetExpForm();
      await load();
      void loadVaults();
      setView("dashboard");
      toast("ok", isEdit ? "修改已保存" : `已保存到「${currentVault?.name ?? "经历库"}」`);
    } catch {
      toast("err", "保存失败：后端没连上");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("确定删除这条经历吗？")) return;
    await fetch(`/api/experiences/${id}`, { method: "DELETE" });
    void load();
    void loadVaults();
    toast("ok", "已删除");
  }

  async function aiStarRun() {
    if (!descText.trim()) {
      toast("err", "先用口语描述一下这段经历，AI 才能帮你提炼");
      return;
    }
    setStarLoading(true);
    try {
      const data = await aiStar(descText, form.type);
      setForm({
        ...form,
        star_s: data.star_s,
        star_t: data.star_t,
        star_a: data.star_a,
        star_r: data.star_r,
        tasks: data.tasks ?? [],
      });
      setStarEngine(data.engine);
      setStarFallbackReason(data.fallback_reason || "");
      const taskNote = data.tasks?.length ? `，拆出 ${data.tasks.length} 项任务` : "";
      toast(
        "ok",
        data.engine === "llm"
          ? `AI 提炼完成${taskNote}，已填入下方（记得检查一遍）`
          : `已用本地引擎填入${taskNote}，建议检查润色`,
      );
    } catch (e) {
      toast("err", `提炼失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setStarLoading(false);
    }
  }

  async function parseResume(source: "file" | "text") {
    setParseLoading(true);
    setParsed(null);
    try {
      let data: ParseResult;
      if (source === "file") {
        if (!importFile) {
          toast("err", "先选择一个简历文件（PDF / DOCX / TXT）");
          return;
        }
        data = await aiParseFile(importFile);
      } else {
        if (resumeText.trim().length < 30) {
          toast("err", "粘贴的文本太短，不像一份简历");
          return;
        }
        data = await aiParseText(resumeText);
      }
      setParsed(data);
      setSelected(new Set(data.experiences.map((_, i) => i))); // 默认全选
      toast("ok", `解析完成，共 ${data.experiences.length} 条，请确认后导入`);
    } catch (e) {
      toast("err", `解析失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setParseLoading(false);
    }
  }

  function toggleSelect(i: number) {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  }

  async function confirmImport() {
    if (!parsed || selected.size === 0) return;
    setImportLoading(true);
    try {
      const chosen = parsed.experiences.filter((_, i) => selected.has(i));
      const res = await fetch("/api/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experiences: chosen, vault_id: vaultId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setParsed(null);
      setImportFile(null);
      setResumeText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
      void loadVaults();
      setView("dashboard");
      const where = currentVault?.name ?? "经历库";
      if (result.skipped > 0) {
        toast(
          "ok",
          `已导入 ${result.imported} 条到「${where}」；${result.skipped} 条与库中已有经历重复，已自动跳过：\n` +
            result.skipped_titles.map((t: string) => `· ${t}`).join("\n"),
        );
      } else {
        toast("ok", `已导入 ${result.imported} 条经历到「${where}」`);
      }
    } catch {
      toast("err", "导入失败：后端没连上");
    } finally {
      setImportLoading(false);
    }
  }

  async function runMatch() {
    if (!jdText.trim()) {
      toast("err", "先粘贴一段岗位 JD 吧");
      return;
    }
    setMatchLoading(true);
    setMatchResult(null);
    try {
      const data = await aiMatch(jdText, experiences, vaultId);
      if (data.hint) {
        toast("err", data.hint);
        return;
      }
      setMatchResult(data);
      rememberJd(jdText);
    } catch (e) {
      toast("err", `匹配失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setMatchLoading(false);
    }
  }

  // 📄 简历：生成 → 存库 → 打开编辑器
  async function generateResume() {
    if (!jdText.trim()) {
      toast("err", "先粘贴岗位 JD 再生成简历");
      return;
    }
    setGenerating(true);
    try {
      const data: GenerateResult = await aiGenerateResume(
        jdText,
        matchResult?.matched.map((m) => m.id) ?? null,
        vaultId,
      );
      if (data.hint) {
        toast("err", data.hint);
        return;
      }
      if (data.engine === "local") {
        toast("err", `云端模型不可用，本次为本地模板拼装结果，请在编辑器中自行润色。${data.fallback_reason || ""}`);
      }
      // 存库（落到当前经历库：帮朋友生成的简历不该混进自己的列表）
      const saveRes = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.resume.title || "未命名简历",
          jd: jdText,
          content: { ...data.resume, template: data.resume.template || loadPreferredTemplate(), photo: "" },
          vault_id: vaultId,
        }),
      });
      if (!saveRes.ok) throw new Error(`HTTP ${saveRes.status}`);
      const saved: Resume = await saveRes.json();
      void loadVaults();
      toast("ok", "简历已生成并保存，可直接编辑后导出");
      openEditor(saved);
    } catch (e) {
      toast("err", `生成失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setGenerating(false);
    }
  }

  const loadResumes = useCallback(async () => {
    try {
      const res = await fetch(withVault("/api/resumes", vaultId));
      if (res.ok) setResumeList(await res.json());
    } catch {
      /* 静默，列表页会显示空态 */
    }
  }, [vaultId]);

  useEffect(() => {
    if (view === "resumes") loadResumes();
  }, [view, loadResumes]);

  /**
   * 打开编辑器。
   * 老简历没有 template / photo 字段，这里补齐默认值——
   * 否则「未保存修改」检测会因为 draft 与快照的键不一致而立刻误报。
   */
  function openEditor(resume: Resume) {
    const normalized: ResumeContent = {
      ...resume.content,
      // 页头两行：姓名 + 联系方式（老简历没有这两个字段，补齐避免受控输入告警
      // 和「未保存修改」的键不一致误报）
      name: resume.content.name ?? "",
      contact: resume.content.contact ?? "",
      template: resume.content.template ?? "classic",
      photo: resume.content.photo ?? "",
    };
    setEditingResumeId(resume.id);
    setDraft(normalized);
    setResumeJd(resume.jd);
    setSavedJson(JSON.stringify(normalized));
    setPreview(false);
    setView("editor");
  }

  async function openResumeById(id: number) {
    const res = await fetch(`/api/resumes/${id}`);
    if (!res.ok) {
      toast("err", "简历加载失败");
      return;
    }
    openEditor(await res.json());
  }

  async function saveResume(): Promise<boolean> {
    if (!draft || editingResumeId === null) return false;
    setResumeSaving(true);
    try {
      const res = await fetch(`/api/resumes/${editingResumeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, jd: resumeJd, content: draft }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedJson(JSON.stringify(draft));
      toast("ok", "已保存");
      return true;
    } catch {
      toast("err", "保存失败：后端没连上");
      return false;
    } finally {
      setResumeSaving(false);
    }
  }

  async function removeResume(id: number) {
    if (!confirm("确定删除这份简历吗？")) return;
    await fetch(`/api/resumes/${id}`, { method: "DELETE" });
    void loadResumes();
    void loadVaults();
    toast("ok", "简历已删除");
  }

  // 不依赖 AI 也能开始：新建一份带常见板块的空白简历
  async function createBlankResume() {
    const content: ResumeContent = {
      ...blankResume(),
      title: "未命名简历",
      sections: (["教育经历", "实习经历", "项目经历", "校园经历", "技能特长"] as const).map((name) => ({
        name,
        items: [{ heading: "", subheading: "", bullets: [""] }],
      })),
    };
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: content.title, jd: "", content, vault_id: vaultId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: Resume = await res.json();
      void loadVaults();
      toast("ok", "已新建空白简历，可在编辑器里从经历库插入内容");
      openEditor(saved);
    } catch {
      toast("err", "新建失败：后端没连上");
    }
  }

  // 投不同岗位时基于同一份简历改一版，不覆盖原版
  async function duplicateResume(id: number) {
    try {
      const res = await fetch(`/api/resumes/${id}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const copy: Resume = await res.json();
      toast("ok", `已另存为副本：${copy.title}`);
      await loadResumes();
    } catch {
      toast("err", "另存副本失败：后端没连上");
    }
  }

  // 从经历库往简历里插入一条经历（按类型落到对应板块）
  const SECTION_BY_TYPE: Record<ExpType, string> = {
    教育: "教育经历",
    实习: "实习经历",
    项目: "项目经历",
    校园: "校园经历",
    科研: "科研经历",
    技能: "技能特长",
  };

  function insertExperience(exp: Experience, sectionName: string) {
    patchDraft((d) => {
      let sec = d.sections.find((s) => s.name === sectionName);
      if (!sec) {
        sec = { name: sectionName, items: [] };
        d.sections.push(sec);
      }
      sec.items.push({
        heading: [exp.title, exp.org].filter(Boolean).join(" · "),
        subheading: exp.date_range,
        bullets: bulletsOf(exp).map(withFullStop),
      });
      return d;
    });
    toast("ok", `已把「${exp.title}」插入「${sectionName}」`);
  }

  /**
   * 真正执行下载。
   * 以前是 `<a href>` 直接跳转下载；线上多设备隔离后，跳转请求带不上
   * 设备标识（X-CV-Owner），后端会当成"别的设备"拒绝 —— 所以统一走
   * fetch + blob（lib/download.ts，设备标识由 device.ts 的补丁注入）。
   *
   * 保存与否由调用方（exportResume / 导出确认弹窗）决定，这里只管下载。
   */
  async function runExport(ext: "pdf" | "docx") {
    if (!editingResumeId) return;
    exportingRef.current = true;
    try {
      const r = await downloadFile(`/api/resumes/${editingResumeId}/export/${ext}`, `简历.${ext}`);
      if (r.ok) toast("ok", ext === "pdf" ? "PDF 已开始下载" : "Word 文档已开始下载");
      else toast("err", r.status === 404 ? "简历不存在或已被删除" : "导出失败，请稍后重试");
    } finally {
      // 留一拍再解除：blob 下载触发的导航事件可能晚于本轮渲染
      setTimeout(() => (exportingRef.current = false), 1500);
    }
  }

  /**
   * 点「导出 PDF / Word」的入口。
   * 有未保存的修改时先弹窗问一句要不要保存：导出件是后端按**已保存内容**
   * 生成的，改了没存就导出，拿到的会是上一版 —— 不能闷声给一份旧简历。
   */
  function exportResume(ext: "pdf" | "docx") {
    if (!editingResumeId) return;
    if (resumeDirty) {
      setExportPrompt(ext);
      return;
    }
    void runExport(ext);
  }

  /** 导出确认弹窗：保存并导出 */
  async function saveAndExport() {
    const ext = exportPrompt;
    setExportPrompt(null);
    if (!ext) return;
    if (await saveResume()) await runExport(ext);
    else toast("err", "保存失败，已取消导出（免得导出成旧版本）");
  }

  /** 导出确认弹窗：不保存，直接导出当前已保存的版本 */
  async function exportWithoutSaving() {
    const ext = exportPrompt;
    setExportPrompt(null);
    if (ext) await runExport(ext);
  }

  // 复制纯文本版简历，方便粘贴到 Word / 招聘网站
  function copyResumeText() {
    if (!draft) return;
    // 与导出件同一页头：只有姓名 + 联系方式两行（职业概述已移除）
    const lines: string[] = [
      draft.name?.trim() || draft.title,
      ...(draft.contact?.trim() ? [draft.contact.trim()] : []),
      "",
    ];
    draft.sections.forEach((s) => {
      lines.push(`【${s.name}】`);
      s.items.forEach((it) => {
        lines.push(`${it.heading}${it.subheading ? `  ${it.subheading}` : ""}`);
        it.bullets.forEach((b) => lines.push(`· ${b}`));
      });
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast("ok", "纯文本简历已复制到剪贴板"),
      () => toast("err", "复制失败，请手动选择文本复制"),
    );
  }

  // 编辑器内容修改助手（不可变更新）
  function patchDraft(fn: (d: ResumeContent) => ResumeContent) {
    setDraft((prev) => (prev ? fn(structuredClone(prev)) : prev));
  }

  /** 换版式：即时生效，并记住偏好（下一份新简历直接沿用） */
  function applyTemplate(id: ResumeTemplate) {
    patchDraft((d) => ({ ...d, template: id }));
    rememberTemplate(id);
  }

  /** 换证件照：data URL 已经在前端压到 320px，直接存进内容里 */
  function applyPhoto(dataUrl: string) {
    patchDraft((d) => ({ ...d, photo: dataUrl }));
    toast("ok", dataUrl ? "照片已添加（会自动压缩后存进简历）" : "照片已移除");
  }

  // 添加要点/条目/板块后自动聚焦到新输入框
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [showInsertPanel, setShowInsertPanel] = useState(false); // 「从经历库插入」面板
  useEffect(() => {
    if (!focusKey) return;
    const el = document.querySelector<HTMLElement>(`[data-focuskey="${focusKey}"]`);
    el?.focus();
    setFocusKey(null);
  }, [draft, focusKey]);

  // 未保存修改检测：离开编辑器前提示，关闭页面也拦截。
  // 导出（runExport）期间放行：blob 下载会引发一次导航事件，
  // 不能让「未保存」弹窗盖在下载动作上（导出前已先落盘）。
  const exportingRef = useRef(false);
  const resumeDirty = draft !== null && JSON.stringify(draft) !== savedJson;
  // 非空即「导出前先问要不要保存」的确认弹窗，值是要导出的格式
  const [exportPrompt, setExportPrompt] = useState<"pdf" | "docx" | null>(null);

  useEffect(() => {
    if (!resumeDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (exportingRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [resumeDirty]);

  // 导出确认弹窗：Esc 关闭
  useEffect(() => {
    if (!exportPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportPrompt(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exportPrompt]);

  // 编辑器内 Ctrl/Cmd+S 快捷保存
  useEffect(() => {
    if (view !== "editor") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (resumeDirty) saveResume();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function backToResumeList() {
    if (resumeDirty && !confirm("有未保存的修改，确定离开吗？（离开将丢失改动）")) return;
    setView("resumes");
  }

  // 主导航：编辑简历有未保存修改时拦截；「记录经历」始终打开空白表单
  function navigate(v: View) {
    if (view === "editor" && resumeDirty && v !== "editor") {
      if (!confirm("有未保存的修改，确定离开吗？（离开将丢失改动）")) return;
    }
    // 回首页时抹掉 #app：这样再刷新仍是首页，而不是被打回工作台
    syncAppHash(v !== "landing");
    if (v === "add") {
      startAdd();
      return;
    }
    setView(v);
  }

  // AI 引擎状态：交给导航栏底部的状态卡渲染
  const aiEngine: AiEngineProps = {
    status: aiStatus,
    models: aiModels,
    model: aiModel,
    checking: aiChecking,
    host: cloudHost,
    onRetry: () => void checkAi(true),
    onModelChange: (id) => {
      setSelectedModel(id);
      setAiModel(id);
    },
  };

  // 经历库上下文：侧边栏（常驻可见）与经历总览页（完整管理）共用同一份
  const vaultControls = {
    vaults,
    currentId: vaultId,
    busy: vaultBusy,
    onSwitch: switchVault,
    onCreate: () => void createVault(),
    onRename: (v: Vault) => void renameVault(v),
    onDelete: (v: Vault) => void removeVault(v),
  };

  // 解析结果里一共拆出了多少项任务：直接告诉用户"分开"这件事做了没有
  const totalTasks = parsed
    ? parsed.experiences.reduce((n, e) => n + (e.tasks?.length ?? 0), 0)
    : 0;

  // 编辑器纸张的版式皮肤：与后端导出（api/export.py）共用同一套 accent / header / section 形态
  const skin = templateOf(draft);
  /** 编辑态的输入框反馈（预览态下不该出现"这个还能点"的暗示） */
  const editHover = preview ? "" : "hover:bg-cv-surface/60 focus:bg-cv-surface/80";
  const editHoverOnDark = preview ? "" : "hover:bg-white/15 focus:bg-white/25";
  const isBand = skin.header === "band";
  const isFormal = skin.id === "formal";
  /**
   * 居中页头（classic / formal）+ 证件照时，照片会占掉右侧一块位置，
   * 把居中的姓名挤到偏左 —— 左侧留一块等宽的空白，姓名才回到纸面的轴对称线上。
   * 编辑态照片位（上传占位框）恒在；预览态只有真有照片才占位，两边要同步。
   */
  const showCenterSpacer = skin.header === "center" && (!preview || Boolean(draft?.photo));
  /** formal 版式把「机构 · 职位」拆成两栏展示（机构居左 / 职位居中），数据里仍是同一个 heading */
  const splitHeading = (h: string): [string, string] => {
    const i = h.indexOf("·");
    return i >= 0 ? [h.slice(0, i).trim(), h.slice(i + 1).trim()] : [h, ""];
  };
  const joinHeading = (org: string, role: string) => [org, role].filter(Boolean).join(" · ");
  const secHeadCls = cn(
    "mb-2 flex items-center gap-2",
    skin.section === "rule" && (isFormal ? "border-b pb-1.5" : "border-b-2 pb-2"),
    skin.section === "bar" && "border-l-4 pl-3",
    skin.section === "block" && "rounded-md px-3.5 py-2",
    skin.section === "big" && "border-b-[3px] pb-1.5",
  );
  const secHeadStyle: React.CSSProperties =
    skin.section === "block"
      ? { background: skin.accent, borderColor: skin.accent }
      : skin.section === "bar"
        ? { borderColor: skin.accent }
        : { borderColor: `${skin.accent}59` };

  /**
   * 产品首页（LandingView）不套 AppShell —— 它是全幅落地页，不该出现导航板。
   * 这一个 early return 放在所有 Hook 之后、主 return 之前，Hook 顺序不受影响，
   * 而从首页点「进入应用」只是把 view 换成 dashboard，数据此时早已加载好了。
   */
  if (view === "landing") {
    return (
      <LandingView
        onEnter={() => {
          syncAppHash(true);
          setView("dashboard");
        }}
      />
    );
  }

  return (
    <>
      <AppShell nav={<Sidebar view={view} onNavigate={navigate} ai={aiEngine} vault={vaultControls} />}>
      {apiError && (
        <div
          role="alert"
          className="mb-6 flex flex-wrap items-center gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <TriangleAlert size={15} aria-hidden="true" /> {apiError}
          <button
            onClick={load}
            className="ml-auto cursor-pointer rounded text-xs font-medium text-amber-900 underline transition-colors hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
          >
            重试
          </button>
        </div>
      )}

        {/* ===== 经历总览 ===== */}
        {view === "dashboard" && (
          <DashboardView
            experiences={experiences}
            vault={vaultControls}
            toast={toast}
            onAdd={startAdd}
            onImport={() => setView("import")}
            onEdit={startEditExp}
            onDelete={remove}
          />
        )}

        {/* ===== 记录经历 ===== */}
        {view === "add" && (
          <section>
            <PageHeader
              label={editingExpId !== null ? "Edit Experience" : "New Experience"}
              icon={editingExpId !== null ? SquarePen : Plus}
              iconTone={editingExpId !== null ? "amber" : "violet"}
              title={editingExpId !== null ? "编辑这段" : "记录一段"}
              accent="经历"
              description={
                editingExpId !== null
                  ? "修改后点击「保存修改」写回经历库"
                  : `先口语化描述，AI 帮你提炼成 STAR；也可以直接手动填写。将记录到「${currentVault?.name ?? "经历库"}」`
              }
              className="relative"
              actions={
                /* 小屏上 actions 会单独占一行，孤零零一个"×"很突兀 ——
                   改为绝对定位收进页头右上角，与眉标同行；sm 以上恢复正常文档流 */
                <span className="max-sm:absolute max-sm:right-0 max-sm:top-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={cancelExpForm}
                    aria-label={editingExpId !== null ? "取消编辑，返回经历列表" : "放弃记录，返回经历列表"}
                    title="取消并返回"
                  >
                    <X size={19} strokeWidth={2.8} aria-hidden="true" />
                  </Button>
                </span>
              }
            />

            <Card className="mt-8 p-6">
              <SectionTitle id="type-picker-label">经历类型</SectionTitle>
              <div
                className="mt-4 flex flex-wrap gap-2.5"
                role="group"
                aria-labelledby="type-picker-label"
              >
                {EXP_TYPES.map((t) => {
                  const active = form.type === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      aria-pressed={active}
                      className={cn(
                        "cursor-pointer rounded-full px-5 py-2.5 font-display text-[13px] font-extrabold transition-all duration-200 ease-out",
                        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30",
                        active
                          ? "bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton"
                          : "border border-white/70 bg-white/70 text-cv-muted-fg shadow-claySoft hover:-translate-y-0.5 hover:text-cv-accent",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card className="mt-4 p-6">
              <SectionTitle>基础信息</SectionTitle>
              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <input
                  aria-label="经历标题"
                  className={INPUT}
                  placeholder="标题，如：产品经理实习"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <input
                  aria-label="组织或公司"
                  className={INPUT}
                  placeholder="组织 / 公司，如：某某科技"
                  value={form.org}
                  onChange={(e) => setForm({ ...form, org: e.target.value })}
                />
                <input
                  aria-label="起止时间"
                  className={INPUT}
                  placeholder="起止时间，如：2025.06 - 2025.09"
                  value={form.date_range}
                  onChange={(e) => setForm({ ...form, date_range: e.target.value })}
                />
                <input
                  aria-label="技能标签"
                  className={INPUT}
                  placeholder="技能标签，用逗号分隔，如：SQL, 需求分析"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                />
              </div>
            </Card>

            {/* AI 提炼入口：只有实习 / 项目 / 校园 / 科研需要把口语描述炼成 STAR；
                教育 / 技能是既成事实——原文照抄，不提炼、也不拆任务 */}
            {!isInfoType(form.type) && (
            <Card tone="accent" className="mt-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle>
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                    AI 提炼 STAR
                  </span>
                </SectionTitle>
                {starEngine && <EngineBadge engine={starEngine} />}
              </div>
              <textarea
                aria-label="口语化经历描述"
                rows={3}
                className={`${INPUT} mt-4 w-full`}
                placeholder="用大白话讲讲这段经历，比如：暑期实习时转化率一直掉，我访谈了十几个用户，用 SQL 分析发现第三步流失最严重，做了三套方案 AB 测试，最后转化率提升 18%"
                value={descText}
                onChange={(e) => setDescText(e.target.value)}
              />
              <button onClick={aiStarRun} disabled={starLoading} className={`${BTN_PRIMARY} mt-4`}>
                <Sparkles size={15} aria-hidden="true" />
                {starLoading ? `AI 提炼中… 已等待 ${elapsed} 秒` : "提炼为 STAR 并填入下方"}
              </button>
              {starEngine === "local" && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-cv-warn/10 px-4 py-3 text-xs font-medium text-cv-warn shadow-claySoft">
                  <TriangleAlert size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    本次结果由本地规则引擎生成，仅供参考。
                    {starFallbackReason ? `原因：${starFallbackReason}` : ""}
                  </span>
                </div>
              )}
            </Card>
            )}

            {/* 任务清单：这段经历里彼此独立的具体任务，每项各有自己的 STAR */}
            {!isInfoType(form.type) && (
            <Card className="mt-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle>
                  <span className="inline-flex items-center gap-2">
                    <ListChecks size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                    任务清单
                  </span>
                </SectionTitle>
                {form.tasks.length > 0 && (
                  <span className="rounded-full bg-white/70 px-3.5 py-1 font-display text-[11px] font-extrabold text-cv-muted-fg shadow-claySoft">
                    {form.tasks.length} 项任务
                  </span>
                )}
              </div>
              <p className="mt-2.5 text-xs font-medium leading-relaxed text-cv-muted-fg">
                一段实习常常包含好几件独立的事，每件事有自己的背景与结果。
                AI 会把它们拆成下面这样一项项任务；背景/目标/结果原文没提到的就留空，不用硬凑。
              </p>
              <TaskEditor
                className="mt-4"
                tasks={form.tasks}
                onChange={(tasks) => setForm({ ...form, tasks })}
              />
              {form.tasks.length === 0 && (
                <div className="mt-3 text-xs font-medium text-cv-muted-fg">
                  还没有任务。可以先在上面用一句话描述，AI 会自动拆分；也可以手动添加。
                </div>
              )}
            </Card>
            )}

            {/* 教育 / 技能：一行一条的原文内容；其余类型：主线 STAR（整段的一句话概括） */}
            {isInfoType(form.type) ? (
              <Card className="mt-4 p-6">
                <SectionTitle>内容（一行一条）</SectionTitle>
                <p className="mt-2.5 text-xs font-medium leading-relaxed text-cv-muted-fg">
                  教育 / 技能是既成事实：<b>内容保持原文</b>（学校、学位、GPA、课程、证书、技能名一个字都不改），
                  但<b>一行一条</b>——原简历里「核心课程：…」「获奖经历：…」各占一行，这里也各占一行。
                  生成简历、导出 PDF / Word 时会照这个分条展示。
                </p>
                <textarea
                  aria-label="内容（一行一条）"
                  rows={6}
                  className={`${INPUT} mt-4 w-full`}
                  placeholder={"产品&数据分析：Figma、Xmind；SQL、Excel、Power BI\n英语：CET-6（580+）、CET-4（620+）\n其他：计算机二级证书"}
                  value={form.star_a}
                  onChange={(e) => setForm({ ...form, star_a: e.target.value })}
                />
              </Card>
            ) : (
              <Card className="mt-4 p-6">
                <SectionTitle>主线 STAR（整段经历的一句话概括）</SectionTitle>
                <p className="mt-2.5 text-xs font-medium leading-relaxed text-cv-muted-fg">
                  这里写这段经历的<b>整体</b>背景、职责与总成果，用来做卡片摘要与岗位匹配。
                  每件事的具体内容请写在上面「任务清单」里，不要堆到这里。
                </p>
                <div className="mt-4 space-y-4">
                  {STAR_FIELDS.map((f) => (
                    <div key={f.key}>
                      <label className="mb-2 block font-display text-[12.5px] font-extrabold text-cv-fg">
                        {f.label} — <span className="font-sans font-normal text-cv-muted-fg">{f.hint}</span>
                      </label>
                      <textarea
                        aria-label={f.label}
                        rows={2}
                        className={`${INPUT} w-full`}
                        value={form[f.key as keyof ExperienceInput] as string}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={save} disabled={saving} className={BTN_PRIMARY}>
                {saving ? "保存中…" : editingExpId !== null ? "保存修改" : "保存到经历库"}
              </button>
              <button onClick={cancelExpForm} className={BTN_GHOST}>
                取消
              </button>
            </div>
          </section>
        )}

        {/* ===== 导入简历 ===== */}
        {view === "import" && (
          <section>
            <PageHeader
              label="Import Resume"
              icon={FileUp}
              iconTone="sky"
              title="导入已有"
              accent="简历"
              description={`上传简历文件或粘贴简历文本，AI 自动把经历拆成条目，并把每条要点拆成独立任务、各自识别 S/T/A/R。导入到「${currentVault?.name ?? "经历库"}」`}
            />

            {!parsed && (
              <>
                <Card className="mt-8 p-6">
                  <SectionTitle>
                    <span className="inline-flex items-center gap-2">
                      <FileText size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                      方式一：上传简历文件
                    </span>
                  </SectionTitle>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      aria-label="选择简历文件"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="text-sm font-medium text-cv-muted-fg file:mr-3 file:px-5 file:py-2.5 file:rounded-md file:border-0 file:bg-white/80 file:font-display file:text-[13px] file:font-extrabold file:text-cv-accent file:shadow-claySoft file:cursor-pointer hover:file:-translate-y-0.5 file:transition-all file:duration-200"
                    />
                    <button
                      onClick={() => parseResume("file")}
                      disabled={parseLoading || !importFile}
                      className={BTN_PRIMARY}
                    >
                      <FileText size={15} aria-hidden="true" />
                      {parseLoading ? `AI 解析中… 已等待 ${elapsed} 秒` : "解析文件"}
                    </button>
                  </div>
                  <div className="mt-3 text-xs font-medium text-cv-muted-fg">
                    支持 PDF / DOCX / TXT，10MB 以内；图片扫描版 PDF 提取不到文字，请改用粘贴文本
                  </div>
                </Card>

                <Card className="mt-4 p-6">
                  <SectionTitle>
                    <span className="inline-flex items-center gap-2">
                      <ClipboardPaste size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                      方式二：粘贴简历文本
                    </span>
                  </SectionTitle>
                  <textarea
                    aria-label="简历文本"
                    rows={8}
                    className={`${INPUT} mt-4 w-full`}
                    placeholder="把简历里的文字全选复制，粘贴到这里……"
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <button
                    onClick={() => parseResume("text")}
                    disabled={parseLoading}
                    className={`${BTN_PRIMARY} mt-4`}
                  >
                    <ClipboardPaste size={15} aria-hidden="true" />
                    {parseLoading ? `AI 解析中… 已等待 ${elapsed} 秒` : "解析文本"}
                  </button>
                </Card>
              </>
            )}

            {parsed && (
              <div className="mt-8">
                <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-display text-[15px] font-extrabold text-cv-fg">
                      解析出 {parsed.experiences.length} 条经历
                      {totalTasks > 0 && ` · 拆出 ${totalTasks} 项任务`}，已选中 {selected.size} 条
                    </span>
                    <EngineBadge engine={parsed.engine} />
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={() => setParsed(null)} className={BTN_GHOST}>
                      ← 重新解析
                    </button>
                    <button
                      onClick={confirmImport}
                      disabled={importLoading || selected.size === 0}
                      className={BTN_ACCENT}
                    >
                      <Check size={15} aria-hidden="true" />
                      {importLoading ? "导入中…" : `确认导入 ${selected.size} 条`}
                    </button>
                  </div>
                </Card>
                {parsed.engine === "local" && (
                  <div className="mt-4 flex items-start gap-2 rounded-md bg-cv-warn/10 px-4 py-3 text-xs font-medium text-cv-warn shadow-claySoft">
                    <TriangleAlert size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      本次解析由本地规则引擎完成，切分可能不精准，请逐条确认后再导入。
                      {parsed.fallback_reason ? `原因：${parsed.fallback_reason}` : ""}
                    </span>
                  </div>
                )}

                <div className="mt-4 space-y-4">
                  {parsed.experiences.map((e, i) => (
                    <label
                      key={i}
                      className={cn(
                        "block cursor-pointer rounded-clay border border-white/60 p-6 shadow-clayCard transition-all duration-300 ease-out",
                        "focus-within:ring-4 focus-within:ring-cv-accent/25",
                        selected.has(i)
                          ? "clay-glass-strong"
                          : "bg-white/35 opacity-70 shadow-claySoft",
                      )}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleSelect(i)}
                          aria-label={`选择导入：${e.title}`}
                          className="h-5 w-5 shrink-0 cursor-pointer rounded accent-cv-accent"
                        />
                        <TypeBadge type={e.type} withIcon />
                        <span className="font-display text-[15px] font-extrabold text-cv-fg">{e.title}</span>
                        {e.org && <span className="text-xs font-medium text-cv-muted-fg">{e.org}</span>}
                        <span className="ml-auto rounded-full bg-white/60 px-3 py-1 font-display text-[11px] font-bold text-cv-muted-fg shadow-claySoft">
                          {e.date_range}
                        </span>
                      </div>
                      {/* 任务清单：这段经历被拆成了哪几件独立的事。
                          旧版这里只会显示一整段 star_a——"全部内容都变成 A"的现场。 */}
                      {e.tasks.length > 0 ? (
                        <div className="pl-8">
                          <div className="mb-2 flex flex-wrap items-center gap-2.5">
                            <span className="inline-flex items-center gap-1.5 font-display text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-cv-accent">
                              <ListChecks size={14} strokeWidth={2.8} aria-hidden="true" />
                              拆出 {e.tasks.length} 项任务
                            </span>
                            <span className="text-[11px] font-medium text-cv-muted-fg">
                              每项任务各自带 S / T / A / R
                            </span>
                          </div>
                          <TaskList tasks={e.tasks} compact />
                        </div>
                      ) : (
                        (() => {
                          // 教育 / 技能：按原简历分条逐行确认（原文一字不改）
                          const lines = isInfoType(e.type)
                            ? infoBullets(e)
                            : [e.star_a, e.star_r].filter(Boolean);
                          return lines.length ? (
                            <ul className="space-y-1 pl-8">
                              {lines.map((line, li) => (
                                <li key={li} className="flex items-start gap-2 text-sm font-medium text-cv-muted-fg">
                                  <span
                                    className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cv-muted-fg/50"
                                    aria-hidden="true"
                                  />
                                  <span>{line}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null;
                        })()
                      )}
                      {e.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 pl-8">
                          {e.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-white/70 bg-white/55 px-3 py-1 font-display text-[11px] font-bold text-cv-muted-fg shadow-claySoft"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ===== 岗位匹配 ===== */}
        {view === "match" && (
          <section>
            <PageHeader
              label="Job Matching"
              icon={Target}
              iconTone="pink"
              title="岗位"
              accent="匹配"
              description={`粘贴目标岗位 JD，AI 从「${currentVault?.name ?? "经历库"}」里挑出最该写进简历的素材`}
            />

            <Card className="mt-8 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle>目标岗位 JD</SectionTitle>
                <button
                  onClick={() => setJdText(DEMO_JD)}
                  className="cursor-pointer rounded-full bg-white/70 px-4 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                >
                  填入示例 JD
                </button>
              </div>
              <textarea
                aria-label="目标岗位 JD"
                rows={6}
                className={`${INPUT} mt-4 w-full`}
                placeholder="把招聘启事里的职位描述粘贴到这里……"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              {jdHistory.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-display text-[11px] font-extrabold text-cv-muted-fg">最近用过：</span>
                  {jdHistory.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setJdText(h);
                        setMatchResult(null);
                      }}
                      title={h.slice(0, 120)}
                      className="max-w-[220px] cursor-pointer truncate rounded-full border border-white/70 bg-white/55 px-3 py-1 font-display text-[11px] font-bold text-cv-muted-fg shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 hover:text-cv-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                    >
                      {h.replace(/\s+/g, " ").slice(0, 22)}…
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={runMatch} disabled={matchLoading || generating} className={BTN_PRIMARY}>
                  <Target size={15} aria-hidden="true" />
                  {matchLoading ? `AI 分析中… 已等待 ${elapsed} 秒` : "开始匹配"}
                </button>
                <button onClick={generateResume} disabled={generating || matchLoading} className={BTN_ACCENT}>
                  <FileText size={15} aria-hidden="true" />
                  {generating ? `AI 生成简历中… 已等待 ${elapsed} 秒` : "直接生成完整简历"}
                </button>
              </div>
              <div className="mt-3 text-xs font-medium text-cv-muted-fg">
                「生成完整简历」会基于 JD 和经历库生成一份结构化简历，生成后可在线编辑
                {matchResult ? "（已按上方匹配结果选用推荐经历）" : ""}
              </div>
            </Card>

            {matchResult && (
              <div className="mt-4">
                <ClayPanel className="flex flex-wrap items-center justify-between gap-5 p-7">
                  <div>
                    <div className="flex items-center gap-3 font-display text-[12px] font-extrabold uppercase tracking-[0.12em] text-white/80">
                      岗位匹配度 <EngineBadge engine={matchResult.engine} />
                    </div>
                    <div className="mt-1.5 font-display text-[3.25rem] font-black leading-none tabular-nums text-white">
                      {matchResult.overall_score}%
                    </div>
                  </div>
                  <div className="text-right text-sm font-medium text-white/90">
                    <div>
                      经历库命中 <b className="font-display font-black">{matchResult.matched.length}</b> 段相关经历
                    </div>
                    {matchResult.missing_skills.length > 0 && (
                      <div className="mt-2">
                        建议补充技能：
                        {matchResult.missing_skills.map((s) => (
                          <span
                            key={s}
                            className="ml-1.5 inline-block rounded-full bg-white/25 px-3 py-1 font-display text-[11px] font-extrabold backdrop-blur-sm"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </ClayPanel>
                {matchResult.engine === "local" && (
                  <div className="mt-4 flex items-start gap-2 rounded-md bg-cv-warn/10 px-4 py-3 text-xs font-medium text-cv-warn shadow-claySoft">
                    <TriangleAlert size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      本次未使用大模型，以上分数与理由由本地规则引擎粗算，仅供参考。
                      {matchResult.fallback_reason ? `原因：${matchResult.fallback_reason}` : ""}
                    </span>
                  </div>
                )}

                {matchResult.matched.length === 0 ? (
                  <div className="mt-4 rounded-clay-lg border-2 border-dashed border-cv-accent/25 bg-white/45 p-10 text-center text-sm font-medium text-cv-muted-fg">
                    {matchResult.hint || "没有匹配到相关经历，先去丰富一下经历库吧"}
                  </div>
                ) : (
                  <>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                      <SectionTitle>推荐写入简历的经历（按相关度排序）</SectionTitle>
                      <div className="flex flex-wrap gap-2.5">
                        <button
                          onClick={() => setView("interview")}
                          className={BTN_GHOST}
                          title="基于这些经历预测面试官会追问什么"
                        >
                          <MessageCircleQuestion size={15} aria-hidden="true" /> 去准备面试追问
                        </button>
                        <button onClick={generateResume} disabled={generating} className={BTN_ACCENT}>
                          <FileText size={15} aria-hidden="true" />
                          {generating ? `AI 生成简历中… 已等待 ${elapsed} 秒` : `用这 ${matchResult.matched.length} 段经历生成完整简历`}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4">
                      {matchResult.matched.map((m) => (
                        <article key={m.id} className={`${CARD} flex gap-5 p-6`}>
                          <div className="w-20 shrink-0 text-center">
                            <div
                              className={cn(
                                "font-display text-[1.75rem] font-black leading-none tabular-nums",
                                m.score >= 85 ? "text-cv-accent" : "text-cv-pink",
                              )}
                            >
                              {m.score}
                            </div>
                            <div className="mt-1 font-display text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-cv-muted-fg">
                              相关度
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2.5">
                              <TypeBadge type={m.type} withIcon />
                              <span className="font-display text-[15px] font-extrabold text-cv-fg">
                                {m.title}
                                {m.org ? ` · ${m.org}` : ""}
                              </span>
                            </div>
                            {m.star_r && (
                              <p className="mb-2 text-xs font-medium leading-relaxed text-cv-muted-fg">
                                {m.star_r}
                              </p>
                            )}
                            <div className="text-xs font-medium text-cv-muted-fg">匹配理由：{m.reason}</div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===== 我的简历（列表） ===== */}
        {view === "resumes" && (
          <section>
            <PageHeader
              label="My Resumes"
              icon={FileText}
              iconTone="emerald"
              title="我的"
              accent="简历"
              description={`当前经历库：${currentVault?.name ?? "—"}。AI 按不同岗位生成的简历都保存在这里；也可以新建空白简历手写，或另存副本改投别的岗位`}
              actions={
                <>
                  <button onClick={createBlankResume} className={BTN_GHOST}>
                    <FilePlus2 size={15} aria-hidden="true" /> 新建空白简历
                  </button>
                  <button onClick={() => setView("match")} className={BTN_PRIMARY}>
                    <Plus size={17} strokeWidth={2.8} aria-hidden="true" /> 去生成新简历
                  </button>
                </>
              }
            />

            {resumeList.length === 0 ? (
              <div className="mt-8 rounded-clay-lg border-2 border-dashed border-cv-accent/25 bg-white/45 p-12 text-center text-sm font-medium text-cv-muted-fg">
                还没有简历。去「岗位匹配」粘贴 JD 生成一份，或点右上角「新建空白简历」手写一份
              </div>
            ) : (
              <div className="mt-8 space-y-4">
                {resumeList.map((r) => (
                  <article
                    key={r.id}
                    className={`${CARD} flex flex-wrap items-center gap-4 p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-clayCardHover`}
                  >
                    {/* 图标+标题一组：小屏 basis-full 独占一行（日期不再被挤成竖排），桌面视觉不变 */}
                    <div className="flex min-w-0 flex-1 items-center gap-4 max-sm:basis-full">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[5px_5px_12px_rgb(16_185_129_/_0.26),-3px_-3px_9px_rgb(255_255_255_/_0.7),inset_3px_3px_6px_rgb(255_255_255_/_0.32)]">
                        <FileText size={19} strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      <button
                        onClick={() => openResumeById(r.id)}
                        className="min-w-0 flex-1 cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                      >
                        <div className="font-display text-[15px] font-extrabold text-cv-fg transition-colors duration-200 hover:text-cv-accent">
                          {r.title}
                        </div>
                        <div className="mt-1 font-display text-[11px] font-bold text-cv-muted-fg">
                          更新于 {r.updated_at.replace("T", " ")}
                        </div>
                      </button>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 max-sm:ml-auto">
                      <button onClick={() => duplicateResume(r.id)} className={BTN_GHOST} title="基于这份简历改一版，投另一个岗位">
                        <Copy size={14} aria-hidden="true" /> 另存副本
                      </button>
                      <button
                        onClick={() => removeResume(r.id)}
                        aria-label={`删除简历：${r.title}`}
                        className="cursor-pointer rounded-sm p-2 text-cv-muted-fg transition-colors duration-200 hover:bg-cv-danger/10 hover:text-cv-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30"
                      >
                        <Trash2 size={16} strokeWidth={2.6} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ===== 简历在线编辑器 ===== */}
        {view === "editor" && draft && (
          <section>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <button onClick={backToResumeList} className={BTN_GHOST}>
                  <ArrowLeft size={15} aria-hidden="true" /> 返回列表
                </button>
                {/* 简历文件名：只出现在列表里，不印在纸面上 */}
                {draft && (
                  <input
                    aria-label="简历名称"
                    readOnly={preview}
                    title="简历在列表里显示的名字（不印在简历上）"
                    className={cn(
                      'w-44 rounded-md border-0 bg-transparent px-2.5 py-1.5 text-[12.5px] font-bold text-cv-muted-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                      preview ? '' : 'hover:bg-cv-surface/60 focus:bg-cv-surface/80',
                    )}
                    value={draft.title}
                    onChange={(e) => patchDraft((d) => ({ ...d, title: e.target.value }))}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {resumeDirty && (
                  <span className="rounded-full bg-cv-warn/10 px-3.5 py-1.5 font-display text-[11.5px] font-extrabold text-cv-warn shadow-claySoft">有未保存的修改</span>
                )}
                <button
                  onClick={() => setPreview((p) => !p)}
                  aria-pressed={preview}
                  className={preview ? BTN_PRIMARY : BTN_GHOST}
                  title={preview ? "回到编辑态" : "隐藏编辑装饰，只看成品版式"}
                >
                  {preview ? <SquarePen size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                  {preview ? "继续编辑" : "效果预览"}
                </button>
                {!preview && (
                  <button
                    onClick={() => setShowInsertPanel((v) => !v)}
                    aria-expanded={showInsertPanel}
                    className={BTN_GHOST}
                    title="把经历库里的经历一键插进这份简历"
                  >
                    <ListChecks size={15} aria-hidden="true" /> 从经历库插入
                  </button>
                )}
                <button onClick={copyResumeText} className={BTN_GHOST}>
                  <Copy size={15} aria-hidden="true" /> 复制全文
                </button>
                <button
                  onClick={() => void exportResume("pdf")}
                  className={BTN_GHOST}
                  aria-label="导出 PDF 文件"
                >
                  <FileDown size={15} aria-hidden="true" /> PDF
                </button>
                <button
                  onClick={() => void exportResume("docx")}
                  className={BTN_GHOST}
                  aria-label="导出 Word 文件"
                >
                  <FileDown size={15} aria-hidden="true" /> Word
                </button>
                <button onClick={saveResume} disabled={resumeSaving} className={BTN_ACCENT} title="快捷键 Ctrl/⌘+S">
                  <Save size={15} aria-hidden="true" />
                  {resumeSaving ? "保存中…" : "保存修改"}
                </button>
              </div>
            </div>

            {/* ---------- 版式 + 证件照（预览态隐藏，让纸面干净） ---------- */}
            {!preview && (
              <Card className="mt-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle>
                    <span className="inline-flex items-center gap-2">
                      <Palette size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                      版式模板
                    </span>
                  </SectionTitle>
                  <span className="text-[11px] font-medium text-cv-muted-fg">
                    点一下即时换版式；导出的 PDF / Word 与这里看到的一致
                  </span>
                </div>
                <TemplatePicker className="mt-4" value={skin.id} onChange={applyTemplate} />

                <div className="mt-5 flex flex-wrap items-start justify-between gap-4 border-t-2 border-dashed border-cv-border pt-4">
                  <div className="min-w-0">
                    <SectionTitle>
                      <span className="inline-flex items-center gap-2">
                        <ImageIcon size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                        证件照
                      </span>
                    </SectionTitle>
                    <p className="mt-2 max-w-md text-xs font-medium leading-relaxed text-cv-muted-fg">
                      可选。照片会自动压到 320px 后再存进简历（数据仍然只在本机），
                      导出 PDF / Word 时会按当前版式放到页头位置。
                    </p>
                  </div>
                  <PhotoField
                    value={draft.photo ?? ""}
                    onChange={applyPhoto}
                    onError={(m) => toast("err", m)}
                  />
                </div>
              </Card>
            )}

            {showInsertPanel && !preview && (
              <Card className="mt-2 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle>
                    <span className="inline-flex items-center gap-2">
                      <ListChecks size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
                      从经历库插入
                    </span>
                  </SectionTitle>
                  <button
                    onClick={() => setShowInsertPanel(false)}
                    aria-label="关闭插入面板"
                    className="cursor-pointer rounded-sm p-2 text-cv-muted-fg transition-colors duration-200 hover:bg-white/70 hover:text-cv-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                  >
                    <X size={16} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </div>
                {experiences.length === 0 ? (
                  <div className="mt-4 text-xs font-medium text-cv-muted-fg">
                    「{currentVault?.name ?? "经历库"}」里还没有经历，先去「记录经历」或「导入简历」
                  </div>
                ) : (
                  <>
                    <div className="cv-scroll mt-4 grid max-h-80 grid-cols-1 gap-2.5 overflow-y-auto pr-2 sm:grid-cols-2">
                      {experiences.map((e) => {
                        const target = SECTION_BY_TYPE[e.type];
                        return (
                          <div
                            key={e.id}
                            className="flex items-center gap-2.5 rounded-md bg-white/60 px-4 py-3 shadow-claySoft"
                          >
                            <TypeBadge type={e.type} className="shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium" title={e.title}>
                              {e.title}
                              {e.org ? ` · ${e.org}` : ""}
                            </span>
                            <button
                              onClick={() => insertExperience(e, target)}
                              className="shrink-0 cursor-pointer rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold text-cv-accent transition-colors duration-200 hover:bg-cv-accent/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                              title={`插入到「${target}」`}
                            >
                              → {target}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 text-[11px] font-medium text-cv-muted-fg">
                      有任务清单的经历会<b>一个任务插入一条要点</b>；没有任务时退回该经历的 A（行动）与 R（结果）。
                      插入后可直接在纸面上修改
                    </div>
                  </>
                )}
              </Card>
            )}

            {/*
              纸张式编辑区：版式皮肤（主色 / 页头形态 / 分区标题形态）跟着模板走。
              尺寸按 A4 真实比例 —— 宽 794px（210mm）、内边距 16mm/14mm（96dpi 下
              60.5px / 53px），与 api/export.py 的 pagesize/margins 逐项对应，
              所以在线看到的换行位置与导出文件一致。
            */}
            <div
              className={cn(
                'mx-auto mt-6 w-full max-w-[794px] rounded-clay-lg border border-white/70 bg-white/85 shadow-clayCard backdrop-blur-xl',
                'px-6 py-8 sm:px-[60.5px] sm:py-[53px]',
                'transition-colors duration-300',
              )}
              style={{ minHeight: A4_PAGE_MIN_H }}
            >
              {/* ---- 页头 ---- */}
              <div
                className={cn('flex items-start gap-5', isBand && 'rounded-clay px-6 py-5')}
                style={isBand ? { background: `linear-gradient(135deg, ${skin.accent}, ${skin.accent}cc)` } : undefined}
              >
                {/* 与右侧证件照等宽的对称占位：让居中的姓名/概述始终落在纸面中轴上 */}
                {showCenterSpacer && <span aria-hidden="true" className="hidden w-24 shrink-0 sm:block" />}
                <div className="min-w-0 flex-1">
                  {/* 第一行：姓名（印在简历上）；title 只是列表文件名，在顶部工具栏改 */}
                  <input
                    aria-label="姓名"
                    readOnly={preview}
                    placeholder="姓名"
                    className={cn(
                      'w-full rounded-md border-0 bg-transparent px-2.5 py-1 font-display font-black tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-4',
                      skin.header === 'center' && 'text-center',
                      isBand
                        ? cn('text-white placeholder:text-white/50 focus-visible:ring-white/40', editHoverOnDark)
                        : cn('text-cv-fg focus-visible:ring-cv-accent/25', editHover),
                    )}
                    style={{ fontSize: NAME_PX[skin.header], ...(!isBand ? { color: skin.accent } : null) }}
                    /* 预览态兑现导出规则：没填姓名时页头显示简历文件名（同 api/export.py） */
                    value={preview ? draft.name?.trim() || draft.title : draft.name ?? ''}
                    onChange={(e) => patchDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                  {/* 第二行：联系方式 —— 邮箱 · 手机号；没填时成品里不占行（同导出） */}
                  {(!preview || Boolean(draft.contact?.trim())) && (
                  <input
                    aria-label="联系方式"
                    readOnly={preview}
                    placeholder="邮箱 · 手机号"
                    className={cn(
                      'mt-0.5 w-full rounded-md border-0 bg-transparent px-2.5 py-1 text-[12.7px] font-medium transition-all duration-200 focus:outline-none focus-visible:ring-4',
                      skin.header === 'center' && 'text-center',
                      isBand
                        ? cn('text-white/85 placeholder:text-white/50 focus-visible:ring-white/40', editHoverOnDark)
                        : cn('text-cv-muted-fg focus-visible:ring-cv-accent/25', editHover),
                    )}
                    value={draft.contact ?? ''}
                    onChange={(e) => patchDraft((d) => ({ ...d, contact: e.target.value }))}
                  />
                  )}
                  {/* 职业概述一行已移除：页头只保留姓名 + 邮箱/手机号两行 */}
                </div>
                <PhotoField
                  value={draft.photo ?? ''}
                  onChange={applyPhoto}
                  onError={(m) => toast('err', m)}
                  onDark={isBand}
                  hideControls={preview}
                />
              </div>

              {/*
                页头分隔线：色带模板自带底色块、经典求职（formal）不画 ——
                formal 的证件照贴在页头右侧，通栏黑线会从照片底下穿过去，
                把纸面切成上下两块，反而破坏一栏式简历的周正感。
              */}
              {!isBand && !isFormal && (
                <div
                  className={cn('mt-4 w-full rounded-full', skin.header === 'big' ? 'h-[5px]' : 'h-[3px]')}
                  style={{
                    background: skin.accent,
                    opacity: skin.header === 'big' ? 0.9 : 0.5,
                  }}
                />
              )}

              {/*
                ---- 正文板块 ----
                间距与导出文件同节奏：板块标题前 15px（= PDF 的 SECTION_GAP_MM 4mm），标题与正文之间 8px。
                成品预览里空板块直接不渲染 —— 和导出口径一致（api/export.py::output_sections）。
              */}
              {draft.sections.map((sec, si) =>
                preview && !sectionHasContent(sec) ? null : (
                <div key={si} className="mt-[15px]">
                  <div className={secHeadCls} style={secHeadStyle}>
                    <input
                      aria-label={`板块名称 ${si + 1}`}
                      readOnly={preview}
                      data-focuskey={`sec-${si}`}
                      className={cn(
                        'rounded-sm border-0 bg-transparent px-2 py-1 font-display font-black transition-all duration-200 focus:outline-none focus-visible:ring-4',
                        skin.section === 'block'
                          ? cn('text-white focus-visible:ring-white/40', editHoverOnDark)
                          : cn('focus-visible:ring-cv-accent/25', editHover),
                      )}
                      style={{
                        fontSize: skin.section === 'big' ? SECTION_TITLE_BIG_PX : SECTION_TITLE_PX,
                        ...(skin.section !== 'block' ? { color: skin.accent } : null),
                      }}
                      value={sec.name}
                      onChange={(e) =>
                        patchDraft((d) => {
                          d.sections[si].name = e.target.value;
                          return d;
                        })
                      }
                    />
                    {!preview && (
                      <button
                        onClick={() => patchDraft((d) => { d.sections.splice(si, 1); return d; })}
                        aria-label={`删除板块：${sec.name}`}
                        className={cn(
                          'ml-auto cursor-pointer rounded-sm p-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30',
                          skin.section === 'block'
                            ? 'text-white/80 hover:bg-white/20 hover:text-white'
                            : 'text-cv-muted-fg hover:bg-cv-danger/10 hover:text-cv-danger',
                        )}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {sec.items.map((it, ii) => {
                    // 预览态与导出口径一致：没有内容的条目直接不渲染（api/export.py::output_sections）
                    if (preview && !itemHasContent(it)) return null;
                    const [orgPart, rolePart] = splitHeading(it.heading);
                    /**
                     * 长标题（比赛 / 论文 / 项目的完整名称）独占一行：
                     * 塞进 1.15fr 的首栏会折成两三行，职位与日期被挤在旁边。
                     * 折行后职位仍留在中栏，所以依旧压在纸面的轴对称线上。
                     */
                    const longOrg = isFormal && orgPart.length > LONG_HEADING_LIMIT;
                    const orgInput = (
                      <input
                        aria-label="条目标题（机构）"
                        readOnly={preview}
                        data-focuskey={`item-${si}-${ii}`}
                        placeholder="机构 / 公司"
                        className={cn(
                          'min-w-0 w-full rounded-sm border-0 bg-transparent px-2 py-1 font-display text-[13.3px] font-extrabold text-cv-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                          editHover,
                        )}
                        value={orgPart}
                        onChange={(e) =>
                          patchDraft((d) => {
                            const [, role] = splitHeading(d.sections[si].items[ii].heading);
                            d.sections[si].items[ii].heading = joinHeading(e.target.value, role);
                            return d;
                          })
                        }
                      />
                    );
                    const roleInput = (
                      <input
                        aria-label="条目职位"
                        readOnly={preview}
                        placeholder="职位 / 专业"
                        className={cn(
                          'min-w-0 w-full rounded-sm border-0 bg-transparent px-2 py-1 text-center font-display text-[13.3px] font-extrabold text-cv-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                          editHover,
                        )}
                        value={rolePart}
                        onChange={(e) =>
                          patchDraft((d) => {
                            const [org] = splitHeading(d.sections[si].items[ii].heading);
                            d.sections[si].items[ii].heading = joinHeading(org, e.target.value);
                            return d;
                          })
                        }
                      />
                    );
                    const dateInput = (
                      <input
                        aria-label="条目副标题（时间）"
                        readOnly={preview}
                        className={cn(
                          'min-w-0 w-full rounded-sm border-0 bg-transparent px-2 py-1 text-right text-[11.3px] font-medium text-cv-muted-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                          editHover,
                        )}
                        value={it.subheading}
                        onChange={(e) =>
                          patchDraft((d) => {
                            d.sections[si].items[ii].subheading = e.target.value;
                            return d;
                          })
                        }
                      />
                    );
                    return (
                    <div key={ii} className="group mb-2">
                      {isFormal ? (
                        <div className="relative flex items-start">
                          <div className="min-w-0 flex-1">
                            {longOrg && <div className="mb-0.5">{orgInput}</div>}
                            <div className="grid min-w-0 grid-cols-[1.29fr_1fr_1.29fr] items-center gap-1">
                              {longOrg ? <span aria-hidden="true" /> : orgInput}
                              {roleInput}
                              {dateInput}
                            </div>
                          </div>
                          {!preview && (
                            /*
                              删除按钮绝对定位到纸张右侧留白里，**不占布局**：
                              行保持全宽，中栏（职位）在编辑态/预览态都压在轴线上，
                              机构名也和栏目标题同一条左边界（不再需要左侧等宽占位）。
                            */
                            <button
                              onClick={() => patchDraft((d) => { d.sections[si].items.splice(ii, 1); return d; })}
                              aria-label="删除此条目"
                              className="absolute -right-8 top-0 inline-flex h-7 w-8 cursor-pointer items-center justify-center rounded-sm text-cv-muted-fg transition-colors duration-200 hover:bg-cv-danger/10 hover:text-cv-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30"
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="relative flex items-center gap-2">
                          <input
                            aria-label="条目标题"
                            readOnly={preview}
                            data-focuskey={`item-${si}-${ii}`}
                            className={cn(
                              'flex-1 rounded-sm border-0 bg-transparent px-2 py-1 font-display text-[13.3px] font-extrabold text-cv-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                              editHover,
                            )}
                            value={it.heading}
                            onChange={(e) =>
                              patchDraft((d) => {
                                d.sections[si].items[ii].heading = e.target.value;
                                return d;
                              })
                            }
                          />
                          <input
                            aria-label="条目副标题（时间）"
                            readOnly={preview}
                            className={cn(
                              'w-44 rounded-sm border-0 bg-transparent px-2 py-1 text-right text-[11.3px] font-medium text-cv-muted-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                              editHover,
                            )}
                            value={it.subheading}
                            onChange={(e) =>
                              patchDraft((d) => {
                                d.sections[si].items[ii].subheading = e.target.value;
                                return d;
                              })
                            }
                          />
                          {!preview && (
                            <button
                              onClick={() => patchDraft((d) => { d.sections[si].items.splice(ii, 1); return d; })}
                              aria-label="删除此条目"
                              className="cursor-pointer rounded-sm p-1.5 text-cv-muted-fg transition-colors duration-200 hover:bg-cv-danger/10 hover:text-cv-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30"
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                      {it.bullets.map((b, bi) => (
                        /*
                          要点行距向产出文件对齐：PDF 里正文是 9.5pt / leading 14pt（≈1.47），
                          换算到屏幕是 12.7px / 18.7px（A4 @96dpi）。
                          要点之间：PDF 是 leading 14pt + spaceBefore 1pt ≈ 20px，所以 mt-0.5 + py-0。
                          -ml-6 抵掉 pl-3+圆点+间距：让要点**文字**与栏目标题/条目标题同一条左边界，
                          圆点悬挂到页面留白里 —— 和导出 PDF（bulletIndent=-9）同一套版式。
                        */
                        <div key={bi} className="-ml-6 mt-0.5 flex items-start gap-1.5 pl-3">
                          <span
                            className="mt-[5px] h-1.5 w-1.5 shrink-0 select-none rounded-full"
                            style={{ background: `${skin.accent}99` }}
                            aria-hidden="true"
                          />
                          {preview ? (
                            /* 成品预览：直接渲染成导出件的样子（含 formal 的「前缀：」加粗） */
                            <div
                              className="min-w-0 flex-1 whitespace-pre-wrap break-words px-2 text-cv-fg"
                              style={{ fontSize: BULLET_PX, lineHeight: `${BULLET_LH_PX}px` }}
                            >
                              {renderBullet(b, isFormal)}
                            </div>
                          ) : (
                            <AutoTextarea
                              aria-label={`要点 ${bi + 1}`}
                              readOnly={preview}
                              data-focuskey={`bullet-${si}-${ii}-${bi}`}
                              className={cn(
                                'flex-1 resize-none overflow-hidden rounded-sm border-0 bg-transparent px-2 py-0 text-[12.7px] font-medium leading-[18.7px] text-cv-fg transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
                                editHover,
                              )}
                              value={b}
                              onChange={(e) =>
                                patchDraft((d) => {
                                  d.sections[si].items[ii].bullets[bi] = e.target.value;
                                  return d;
                                })
                              }
                            />
                          )}
                          {!preview && (
                            <button
                              onClick={() => patchDraft((d) => { d.sections[si].items[ii].bullets.splice(bi, 1); return d; })}
                              aria-label="删除此要点"
                              className="mt-0.5 cursor-pointer rounded-sm p-1 text-cv-muted-fg transition-colors duration-200 hover:bg-cv-danger/10 hover:text-cv-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30"
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                      {!preview && (
                        <button
                          onClick={() => {
                            patchDraft((d) => { d.sections[si].items[ii].bullets.push(""); return d; });
                            setFocusKey(`bullet-${si}-${ii}-${draft!.sections[si].items[ii].bullets.length}`);
                          }}
                          className="ml-2 mt-2 cursor-pointer rounded-full bg-white/70 px-3.5 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                        >
                          + 添加要点
                        </button>
                      )}
                    </div>
                    );
                  })}

                  {!preview && (
                    <button
                      onClick={() => {
                        patchDraft((d) => {
                          d.sections[si].items.push({ heading: "新条目", subheading: "", bullets: [""] });
                          return d;
                        });
                        setFocusKey(`item-${si}-${draft!.sections[si].items.length}`);
                      }}
                      className="cursor-pointer rounded-full bg-white/70 px-3.5 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                    >
                      + 添加条目
                    </button>
                  )}
                </div>
              ))}

              {!preview && (
                <button
                  onClick={() => {
                    patchDraft((d) => {
                      d.sections.push({ name: "新板块", items: [{ heading: "", subheading: "", bullets: [""] }] });
                      return d;
                    });
                    setFocusKey(`sec-${draft!.sections.length}`);
                  }}
                  className="mt-5 cursor-pointer rounded-full bg-white/70 px-3.5 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                >
                  + 添加板块
                </button>
              )}
            </div>

            {preview && (
              <p className="mx-auto mt-4 max-w-3xl text-center text-[11.5px] font-medium text-cv-muted-fg">
                这是「{skin.name}」的成品效果；导出的 PDF / Word 与这版一致，照片会按版式出现在页头
              </p>
            )}
          </section>
        )}
        {/* ===== 面试准备 ===== */}
        {view === "interview" && (
          <InterviewView experiences={experiences} toast={toast} vaultId={vaultId} />
        )}

        {/* ===== 数据备份 ===== */}
        {view === "data" && (
          <DataView
            toast={toast}
            onDataChanged={() => {
              // 从备份 / 回收站恢复出来的库要立刻出现在切换器里
              void loadVaults();
              void load();
            }}
          />
        )}
      </AppShell>

      {/* Toast 通知（右上角，自动消失） */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-5 top-5 z-50 w-[22rem] max-w-[calc(100vw-2.5rem)] space-y-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex animate-pop-in items-start gap-3 rounded-md border border-white/70 clay-glass-strong px-5 py-4 text-sm font-medium shadow-clayCard",
              t.kind === "ok" ? "text-cv-fg" : "text-cv-fg",
            )}
          >
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
                t.kind === "ok"
                  ? "bg-gradient-to-br from-emerald-400 to-cv-ok shadow-[3px_3px_8px_rgb(16_185_129_/_0.3)]"
                  : "bg-gradient-to-br from-red-400 to-cv-danger shadow-[3px_3px_8px_rgb(239_68_68_/_0.3)]",
              )}
            >
              {t.kind === "ok" ? (
                <Check size={15} strokeWidth={3} aria-hidden="true" />
              ) : (
                <TriangleAlert size={15} strokeWidth={2.8} aria-hidden="true" />
              )}
            </span>
            <span className="whitespace-pre-line pt-0.5 leading-relaxed">{t.text}</span>
          </div>
        ))}
      </div>

      {/* 删除经历库后的撤销条（底部，10 秒） */}
      {undoDelete && (
        <UndoBar
          message={`已删除「${undoDelete.name}」`}
          hint={
            `${undoDelete.experiences} 段经历 · ${undoDelete.resumes} 份简历已移入本机回收站，` +
            "也可以在「数据备份」页找回"
          }
          busy={undoBusy}
          onAction={() => void undoRemoveVault()}
          onClose={() => setUndoDelete(null)}
        />
      )}

      {/* 导出前的确认弹窗：有未保存修改时问一句要不要先保存（导出件按已保存内容生成） */}
      {exportPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-prompt-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-cv-ink/30 px-5 backdrop-blur-sm"
          onClick={() => setExportPrompt(null)}
        >
          <div
            className="w-full max-w-md animate-pop-in rounded-lg border border-white/70 clay-glass-strong p-6 shadow-clayCard"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-amber-300 to-cv-warn text-white shadow-[4px_4px_10px_rgb(245_158_11_/_0.3),-2px_-2px_7px_rgb(255_255_255_/_0.7),inset_2px_2px_5px_rgb(255_255_255_/_0.4)]">
                <TriangleAlert size={19} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 id="export-prompt-title" className="font-display text-base font-extrabold text-cv-fg">
                  有未保存的修改
                </h3>
                <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-cv-muted-fg">
                  这份简历改过还没保存。导出的 {exportPrompt === "pdf" ? "PDF" : "Word"} 是按
                  <span className="font-extrabold text-cv-fg">已保存的内容</span>
                  生成的，要先保存这次的修改吗？
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              <button onClick={() => setExportPrompt(null)} className={BTN_GHOST}>
                取消
              </button>
              <button onClick={() => void exportWithoutSaving()} className={BTN_GHOST}>
                不保存，直接导出
              </button>
              <button onClick={() => void saveAndExport()} className={BTN_PRIMARY}>
                <Save size={15} aria-hidden="true" /> 保存并导出
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
