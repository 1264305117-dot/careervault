import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  HelpCircle,
  Lightbulb,
  MessageCircleQuestion,
  Sparkles,
  Target,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import type { Experience, InterviewResult } from "@/types/experience";
import { BTN_GHOST, BTN_PRIMARY, CARD, INPUT, type ToastFn } from "@/lib/ui";
import { Card, PageHeader, SectionTitle, TypeBadge } from "@/components/cv";
import { aiInterview } from "@/lib/ai";
import { cn } from "@/lib/utils";

const PREPARED_KEY = "cv_interview_prepared";

function loadPrepared(): string[] {
  try {
    const raw = localStorage.getItem(PREPARED_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 面试准备：基于经历库预测面试官可能的追问（产品定义里的「面试准备」场景）。
 * LLM 优先，失败降级本地模板；「已准备」进度存在本地，刷新不丢。
 */
export default function InterviewView({
  experiences,
  toast,
  vaultId = null,
}: {
  experiences: Experience[];
  toast: ToastFn;
  /** 当前经历库；本地保底引擎要按库读数据 */
  vaultId?: number | null;
}) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [jd, setJd] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [fallbackReason, setFallbackReason] = useState("");
  const [prepared, setPrepared] = useState<string[]>(loadPrepared);
  const initedRef = useRef(false);

  // 首次拿到经历数据时默认全选
  useEffect(() => {
    if (!initedRef.current && experiences.length > 0) {
      setPicked(new Set(experiences.map((e) => e.id)));
      initedRef.current = true;
    }
  }, [experiences]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [loading]);

  useEffect(() => {
    try {
      localStorage.setItem(PREPARED_KEY, JSON.stringify(prepared));
    } catch {
      /* 隐私模式下写不了，忽略即可 */
    }
  }, [prepared]);

  function togglePick(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePrepared(question: string) {
    setPrepared((prev) =>
      prev.includes(question) ? prev.filter((q) => q !== question) : [...prev, question],
    );
  }

  async function generate() {
    if (experiences.length === 0) {
      toast("err", "经历库还是空的，先记录或导入经历");
      return;
    }
    if (picked.size === 0) {
      toast("err", "先勾选至少一段要准备面试的经历");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await aiInterview([...picked], jd, vaultId);
      if (data.hint) {
        toast("err", data.hint);
        return;
      }
      setResult(data);
      setFallbackReason(data.fallback_reason || "");
      if (data.questions.length === 0) toast("err", "这次没生成出追问，换几段经历再试试");
      else toast("ok", `已预测 ${data.questions.length} 个可能被追问的问题`);
    } catch (e) {
      toast("err", `生成失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setLoading(false);
    }
  }

  function copyAll() {
    if (!result) return;
    const lines = ["【面试追问预测】", ""];
    result.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`);
      if (q.why) lines.push(`   考察点：${q.why}`);
      if (q.hint) lines.push(`   准备建议：${q.hint}`);
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => toast("ok", "追问清单已复制到剪贴板"),
      () => toast("err", "复制失败，请手动选择文本复制"),
    );
  }

  const doneCount = result
    ? result.questions.filter((q) => prepared.includes(q.question)).length
    : 0;

  const progress = result && result.questions.length > 0 ? doneCount / result.questions.length : 0;

  return (
    <section>
      <PageHeader
        label="Interview Prep"
        icon={MessageCircleQuestion}
        iconTone="amber"
        title="面试"
        accent="准备"
        description="基于你的经历库，预测面试官最可能追问什么，并给出可以直接照着准备的建议"
      />

      {experiences.length === 0 ? (
        <div className="mt-8 rounded-clay-lg border-2 border-dashed border-cv-accent/25 bg-white/45 p-12 text-center text-sm font-medium text-cv-muted-fg">
          经历库还是空的。先去「记录经历」或「导入简历」，这里才能帮你预测追问
        </div>
      ) : (
        <>
          <Card className="mt-8 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>
                选择要准备面试的经历（已选 {picked.size} / {experiences.length}）
              </SectionTitle>
              <div className="flex gap-2">
                <button
                  onClick={() => setPicked(new Set(experiences.map((e) => e.id)))}
                  className="cursor-pointer rounded-full bg-white/70 px-4 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                >
                  全选
                </button>
                <button
                  onClick={() => setPicked(new Set())}
                  className="cursor-pointer rounded-full bg-white/70 px-4 py-1.5 font-display text-[11.5px] font-extrabold text-cv-muted-fg shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                >
                  清空
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {experiences.map((e) => {
                const on = picked.has(e.id);
                return (
                  <label
                    key={e.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md border px-4 py-3 transition-all duration-200",
                      "focus-within:ring-4 focus-within:ring-cv-accent/25",
                      on
                        ? "border-white/70 bg-white/80 shadow-claySoft"
                        : "border-white/50 bg-white/35 opacity-70 shadow-none",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => togglePick(e.id)}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded accent-cv-accent"
                      aria-label={`选择经历：${e.title}`}
                    />
                    <TypeBadge type={e.type} className="shrink-0" />
                    <span className="truncate text-sm font-medium">
                      {e.title}
                      {e.org ? ` · ${e.org}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5">
              <label className="mb-2 block font-display text-[12.5px] font-extrabold text-cv-fg">
                目标岗位 JD
                <span className="ml-2 font-sans font-normal text-cv-muted-fg">
                  可选，填了会生成"这段经历和岗位的关联"类追问
                </span>
              </label>
              <input
                className={`${INPUT} w-full`}
                placeholder="粘贴岗位 JD 或一句话岗位描述"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                aria-label="目标岗位 JD（可选）"
              />
            </div>

            <button onClick={generate} disabled={loading} className={`${BTN_PRIMARY} mt-5`}>
              <Sparkles size={15} aria-hidden="true" />
              {loading ? `AI 预测中… 已等待 ${elapsed} 秒` : "预测面试追问"}
            </button>
          </Card>

          {result && (
            <div className="mt-4">
              <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-display text-[15px] font-extrabold text-cv-fg">
                      共 {result.questions.length} 个可能的追问
                    </span>
                    <span className="font-display text-[12px] font-bold text-cv-muted-fg">
                      已准备 <b className="text-cv-accent">{doneCount}</b> / {result.questions.length}
                    </span>
                  </div>
                  {/* 进度条：凹槽 + 凸起的紫色填充，是"已完成多少"最直观的表达 */}
                  <div
                    className="mt-3 h-3 w-full overflow-hidden rounded-full bg-cv-surface shadow-clayPressedSm"
                    role="progressbar"
                    aria-valuenow={doneCount}
                    aria-valuemin={0}
                    aria-valuemax={result.questions.length}
                    aria-label="面试追问准备进度"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cv-accent-2 to-cv-accent shadow-[2px_2px_6px_rgb(124_58_237_/_0.4),inset_0_2px_4px_rgb(255_255_255_/_0.45)] transition-all duration-500 ease-out"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button onClick={copyAll} className={BTN_GHOST}>
                    <Copy size={15} aria-hidden="true" /> 复制清单
                  </button>
                  <button
                    onClick={() => {
                      setResult(null);
                      setPrepared([]);
                    }}
                    className={BTN_GHOST}
                  >
                    重新开始
                  </button>
                </div>
              </Card>

              {result.engine === "local" && (
                <div className="mt-4 flex items-start gap-2 rounded-md bg-cv-warn/10 px-4 py-3 text-xs font-medium text-cv-warn shadow-claySoft">
                  <TriangleAlert size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    本次未使用大模型，以下追问由本地模板按你的经历字段生成，偏通用；建议补充 A/R 段细节后再试。
                    {fallbackReason ? `原因：${fallbackReason}` : ""}
                  </span>
                </div>
              )}

              <div className="mt-4 space-y-4">
                {result.questions.map((q, i) => {
                  const isDone = prepared.includes(q.question);
                  return (
                    <article
                      key={`${i}-${q.question}`}
                      className={cn(
                        CARD,
                        "p-6 transition-all duration-300 ease-out",
                        isDone && "border-white/70 bg-gradient-to-br from-cv-accent/[0.09] to-cv-pink/[0.05]",
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className={cn(
                            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-[13px] font-black text-white',
                            isDone
                              ? 'bg-gradient-to-br from-emerald-400 to-cv-ok shadow-[4px_4px_10px_rgb(16_185_129_/_0.28),inset_2px_2px_5px_rgb(255_255_255_/_0.4)]'
                              : 'bg-gradient-to-br from-cv-accent-2 to-cv-accent shadow-claySoft',
                          )}
                          aria-hidden="true"
                        >
                          {isDone ? <Check size={15} strokeWidth={3} /> : i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-display text-[15px] font-extrabold leading-snug text-cv-fg">
                            {q.question}
                          </div>
                          {q.experience_title && (
                            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 font-display text-[11px] font-bold text-cv-muted-fg shadow-claySoft">
                              <Target size={11} strokeWidth={2.8} aria-hidden="true" /> 关联：{q.experience_title}
                            </div>
                          )}
                          {q.why && (
                            <div className="mt-2.5 flex items-start gap-2 text-xs font-medium text-cv-muted-fg">
                              <HelpCircle size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden="true" />
                              <span>考察点：{q.why}</span>
                            </div>
                          )}
                          {q.hint && (
                            <div className="mt-2 flex items-start gap-2 text-xs font-medium text-cv-fg/85">
                              <Lightbulb
                                size={14}
                                strokeWidth={2.6}
                                className="mt-0.5 shrink-0 text-cv-accent"
                                aria-hidden="true"
                              />
                              <span>准备建议：{q.hint}</span>
                            </div>
                          )}
                        </div>
                        <label className="inline-flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-full bg-white/70 px-3.5 py-2 font-display text-[11.5px] font-extrabold text-cv-muted-fg shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-within:ring-4 focus-within:ring-cv-accent/25">
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => togglePrepared(q.question)}
                            className="h-4 w-4 cursor-pointer rounded accent-cv-accent"
                            aria-label={`标记已准备：${q.question}`}
                          />
                          <UserCheck size={14} strokeWidth={2.6} aria-hidden="true" />
                          已准备
                        </label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
