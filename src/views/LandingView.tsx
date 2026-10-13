import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Compass,
  DatabaseBackup,
  FileDown,
  FileStack,
  FileUp,
  Lock,
  MessageCircleQuestion,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';
import { Button, Card, ClayPanel, IconTile, Reveal, SectionLabel } from '@/components/cv';
import { Blobs } from '@/components/layout/Blobs';
import { cn } from '@/lib/utils';

/**
 * LandingView —— 「生职迹」首页（产品介绍页）。
 *
 * 这一页不是应用的一部分，而是应用的**门面**：第一次打开的人只看得到它，
 * 需要在不点任何按钮的前提下回答三个问题 ——
 *   1. 这是什么？      → 第一屏大标题 + 一句话定义
 *   2. 能解决我什么问题？→ 「痛点 → 它怎么做」三张对照卡
 *   3. 我要怎么开始？   → 四步流程 + 底部 CTA
 *
 * 视觉上沿用应用内的黏土语言（同一套令牌与组件），但**不套 AppShell**：
 * 首页没有导航板，是全幅的落地页。背景光斑自己铺（Blobs），
 * 与内部页面用的是同一个光源，所以从首页点进应用不会有"换了个产品"的断裂感。
 *
 * 篇幅克制：五屏讲完。落地页的失败方式几乎都是"太长"。
 */

/* ---------------- 文案数据 ---------------- */

const PAINS: { before: string; after: string; detail: string; tone: 'violet' | 'pink' | 'sky' }[] = [
  {
    before: '经历散在备忘录、旧简历和聊天记录里',
    after: '一个「经历库」，长期沉淀',
    detail:
      '实习、项目、校园、科研、技能都记进同一个库，越用越厚。要帮朋友梳理就新建一个库，他的经历和简历待在自己的库里，不会和你混在一起。',
    tone: 'violet',
  },
  {
    before: '每次投岗都要把简历重写一遍',
    after: '对着 JD 一键生成',
    detail:
      '粘贴目标岗位的 JD，AI 只从你库里挑那些**真实发生过**的经历来组织措辞，不会替你编造没做过的事。',
    tone: 'pink',
  },
  {
    before: '写完心里没底，不知道差在哪',
    after: '先打分，再补强',
    detail:
      '岗位匹配会给出匹配度、逐条指出 JD 里要求而你没有体现的能力，并告诉你该补哪段经历、哪句措辞。',
    tone: 'sky',
  },
];

const FEATURES: {
  icon: typeof Sparkles;
  tone: 'violet' | 'pink' | 'sky' | 'emerald' | 'amber';
  title: string;
  desc: string;
}[] = [
  {
    icon: FileStack,
    tone: 'violet',
    title: '经历沉淀',
    desc: '每段经历用 STAR 记录背景与结果，再拆成一条条独立任务——简历要的颗粒度，在这里就长好了。',
  },
  {
    icon: FileUp,
    tone: 'pink',
    title: '导入旧简历',
    desc: '上传 PDF / Word 或直接粘贴文本，自动拆成结构化的经历条目，不用重新手打一遍。',
  },
  {
    icon: BrainCircuit,
    tone: 'sky',
    title: 'AI 提炼 STAR',
    desc: '把一段大白话的流水账，整理成「情境 / 任务 / 行动 / 结果」四段，结果里尽量逼出数字。',
  },
  {
    icon: Target,
    tone: 'amber',
    title: '岗位匹配',
    desc: '贴一段 JD，得到匹配度打分、命中与缺失的能力项，以及可以马上动手补的地方。',
  },
  {
    icon: FileDown,
    tone: 'emerald',
    title: '生成与导出',
    desc: '五套版式（经典求职 / 经典居中 / 现代色带 / 时间轴 / 醒目大字），在线所见即所得，导出 PDF 与 Word。',
  },
  {
    icon: MessageCircleQuestion,
    tone: 'violet',
    title: '面试准备',
    desc: '基于你的真实经历推演面试官会追问什么，并给出回答思路——问的都是你写过的东西。',
  },
];

const STEPS: { n: string; title: string; desc: string }[] = [
  { n: '01', title: '沉淀', desc: '把这几年做过的事记进经历库；也可以直接导入旧简历，让 AI 帮你拆。' },
  { n: '02', title: '定岗', desc: '粘贴一段目标岗位的 JD，或者从历史记录里挑一条最近投过的。' },
  { n: '03', title: '生成', desc: '一键生成简历，同时拿到匹配度与差距清单，知道该往哪里补。' },
  { n: '04', title: '导出', desc: '在线调整版式与措辞，导出 PDF / Word，直接拿去投递。' },
];

const TRUST: { icon: typeof Lock; title: string; desc: string }[] = [
  {
    icon: Sparkles,
    title: '免密钥用 AI',
    desc: '大模型跑在云端，打开就能用，不需要自己准备任何 API Key。',
  },
  {
    icon: Lock,
    title: '各用各的空间',
    desc: '每个浏览器一套独立的经历库，别人打开同一个链接也看不到你的数据。',
  },
  {
    icon: DatabaseBackup,
    title: '数据随时带走',
    desc: '一键导出全部数据（含回收站），换台设备导入就能原样恢复。',
  },
];

/* ---------------- 局部组件 ---------------- */

/**
 * 品牌标识：渐变黏土球 + 中英文名。
 *
 * 两档尺寸：`md` 给顶栏（门面，要大一点才立得住），`sm` 给页脚。
 */
function Brand({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const big = size === 'md';
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center rounded-md',
          'bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton',
          big ? 'h-10 w-10' : 'h-9 w-9',
        )}
      >
        <Route size={big ? 20 : 17} strokeWidth={2.6} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block font-display font-black leading-tight tracking-tight text-cv-fg',
            big ? 'text-[19.5px]' : 'text-[16.5px]',
          )}
        >
          生职迹
        </span>
        <span
          className={cn(
            'mt-[2px] block font-display font-extrabold uppercase tracking-[0.18em] text-cv-muted-fg/80',
            big ? 'text-[10px]' : 'text-[9px]',
          )}
        >
          Career Trail
        </span>
      </span>
    </span>
  );
}

/**
 * 仿证件照矢量图 —— 样张右上角的占位照片。
 *
 * 纯矢量：零请求、缩放不糊。人像只用"圆头 + 弧形肩线"两笔线条勾出
 * （通用头像图标的样子），不画五官——一眼是证件照就够了。
 */
function IdPhoto() {
  return (
    <svg
      viewBox="0 0 60 80"
      role="img"
      aria-label="证件照示意"
      className="h-[68px] w-[51px] shrink-0 rounded-[5px] border border-[#CFC3EA] bg-white shadow-[0_2px_6px_rgba(160,150,180,0.35)]"
    >
      <defs>
        <linearGradient id="cvIdBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EDF4FC" />
          <stop offset="100%" stopColor="#D3E2F4" />
        </linearGradient>
        <clipPath id="cvIdFrame">
          <rect x="0" y="0" width="60" height="80" rx="3" />
        </clipPath>
      </defs>
      <g clipPath="url(#cvIdFrame)">
        <rect x="0" y="0" width="60" height="80" fill="url(#cvIdBg)" />
        {/* 头：正圆；肩线：一段开口朝下的弧，与参考图标同构 */}
        <circle cx="30" cy="31" r="10.5" fill="none" stroke="#4B4B54" strokeWidth="3.4" />
        <path
          d="M11 62a19 19 0 0 1 38 0"
          fill="none"
          stroke="#4B4B54"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** 样张里的一个经历条目：标题行 + 要点列表（首页样张三处复用）。 */
function SampleSection({
  title,
  org,
  date,
  bullets,
}: {
  title: string;
  org: string;
  date: string;
  bullets: string[];
}) {
  return (
    <>
      <div
        className="mt-5 border-b pb-1.5 text-[12px] font-black tracking-wide text-[#7C3AED]"
        style={{ borderColor: '#7C3AED59' }}
      >
        {title}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] font-bold text-[#332F3A]">{org}</span>
        <span className="shrink-0 text-[9.5px] font-medium text-[#635F69]">{date}</span>
      </div>
      <ul className="mt-1.5 space-y-[4px]">
        {bullets.map((t) => (
          <li key={t} className="flex gap-1.5 text-[10px] leading-[16px] text-[#332F3A]">
            <span
              className="mt-[5px] h-[3.5px] w-[3.5px] shrink-0 rounded-full bg-[#7C3AED99]"
              aria-hidden="true"
            />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * 简历纸样张 —— 首页右侧的"实物"。
 *
 * 刻意用真实文案而不是灰色占位条：灰条看起来像线框图，一个字都读不出来的
 * 样张说服不了任何人。这里放的是这个产品真正产出的东西的缩样。
 */
function ResumeSample() {
  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      {/* 纸后的柔光：让白纸从背景里"浮"起来 */}
      <div
        aria-hidden="true"
        className="absolute -inset-10 rounded-clay-xl bg-gradient-to-br from-cv-accent/20 via-cv-pink/12 to-cv-sky/20 blur-2xl"
      />

      {/* 叠在主纸后面的两层卡片：呼应「一叠经历」的意象，主简历纸仍是主体 */}
      <div
        aria-hidden="true"
        className="absolute -left-[10%] top-[3%] h-[95%] w-[90%] -rotate-[9deg] rounded-clay-lg border border-white/70 bg-white/70 shadow-clayCard"
      />
      <div
        aria-hidden="true"
        className="absolute -right-[8%] top-[5%] h-[93%] w-[86%] rotate-[7deg] rounded-clay-lg border border-white/70 bg-white/80 shadow-clayCard"
      >
        {/* 书签缎带：底部剪出燕尾口，像夹在纸堆里的书签 */}
        <span
          aria-hidden="true"
          className="absolute right-5 top-4 h-10 w-5 rounded-t-[3px] bg-gradient-to-b from-cv-accent-2 to-cv-accent [clip-path:polygon(0_0,100%_0,100%_100%,50%_76%,0_100%)]"
        />
      </div>

      <div className="relative rounded-clay-lg border border-white/80 bg-white/95 px-7 py-7 shadow-clayCard">
        {/* 页头：第一行姓名、第二行联系方式；证件照靠右，正文自动让位 */}
        <div className="flex items-start gap-3.5">
          <div className="min-w-0 flex-1 pt-0.5 text-center">
            <div className="font-display text-[23px] font-black leading-none tracking-tight text-[#332F3A]">
              小职
            </div>
            <div className="mt-2 text-[10px] font-medium leading-none text-[#635F69]">
              xiaozhi@example.com · 138-0000-0000
            </div>
          </div>
          <IdPhoto />
        </div>

        <SampleSection
          title="实习经历"
          org="XX 证券 · 行业研究实习生"
          date="2025.07–2025.10"
          bullets={[
            '行业研究：独立完成 3 篇深度报告，覆盖 12 家上市公司。',
            '数据搭建：用 Python 重建财务数据库，取数效率提升 60%。',
          ]}
        />

        <SampleSection
          title="项目经历"
          org="金融科技创新大赛 · 队长"
          date="2024.03–2024.08"
          bullets={[
            '模型搭建：基于 5 年财报数据构建信用评分模型，AUC 达 0.86。',
            '落地验证：在 3 家小微企业试点，审批时效由 3 天压缩到 4 小时。',
          ]}
        />

        {/* 底部渐隐：暗示"内容还有很多"，只压住最后半行，别把新写的项目内容盖没了 */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-[inherit] bg-gradient-to-t from-white via-white/80 to-transparent"
        />
      </div>

      {/* 浮动标签：匹配度 + 生成来源。压在纸边上、避开正文行 */}
      <div className="absolute -left-8 top-[21%] hidden animate-clay-float items-center gap-2 rounded-md border border-white/70 clay-glass-strong px-3 py-2 shadow-clayCard sm:flex">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cv-ok text-[9px] font-black text-white">
          92
        </span>
        <span className="font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-cv-muted-fg">
          匹配度
        </span>
      </div>

      <div
        className="absolute -right-8 bottom-[1%] hidden animate-clay-float-delayed items-center gap-1.5 rounded-md border border-white/70 clay-glass-strong px-3 py-2 shadow-clayCard sm:flex"
        style={{ animationDelay: '1.2s' }}
      >
        <Sparkles size={13} className="text-cv-accent" aria-hidden="true" />
        <span className="font-display text-[10px] font-extrabold uppercase tracking-[0.12em] text-cv-muted-fg">
          从经历库生成
        </span>
      </div>
    </div>
  );
}

/* ---------------- 页面 ---------------- */

export default function LandingView({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-cv-fg">
      <Blobs />

      {/* ---------- 顶栏 ----------
          不用实色块（底部会留一条硬边）：改成竖向渐变，顶部略深、往下融进画布，
          导航区被"托"起来但没有任何分界线，和黏土的柔和语气一致。 */}
      <div className="relative bg-gradient-to-b from-[#E6DCF4] via-[#EDE7F8] to-cv-bg pb-2">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-7 lg:px-10">
        <Brand />
        <div className="flex items-center gap-2">
          <a
            href="#how"
            className={cn(
              'hidden rounded-md px-4 py-2 font-display text-[13px] font-bold text-cv-muted-fg transition-colors duration-200',
              'hover:bg-cv-accent/10 hover:text-cv-accent sm:inline-flex',
            )}
          >
            怎么用
          </a>
          <Button size="sm" className="px-5" onClick={onEnter}>
            进入应用
            <ArrowRight size={14} aria-hidden="true" />
          </Button>
        </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-7 lg:px-10">
        {/* ---------- 1. 第一屏 ---------- */}
        <section className="grid grid-cols-1 items-center gap-12 pb-16 pt-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-8 lg:pb-24 lg:pt-14">
          <Reveal>
            <SectionLabel>Career Trail · 个人经历库与 AI 简历</SectionLabel>

            <h1 className="mt-5 font-display text-[2.05rem] font-black leading-[1.24] tracking-tight text-cv-fg sm:text-[2.6rem] lg:text-[2.85rem]">
              把散落的经历
              <br />
              沉淀成一份
              <br />
              <span className="clay-text-gradient">对得上岗位的简历</span>
            </h1>

            {/* 拆成两段：一句定义 + 一句展开。整段堆在一起时，中文行距一紧就糊成一坨 */}
            <div className="mt-6 max-w-md space-y-3">
              <p className="text-[15.5px] font-medium leading-[1.95] text-cv-muted-fg sm:text-[17px]">
                生职迹是一个「个人经历库 + AI 简历工作台」。
              </p>
              <p className="text-[14px] font-medium leading-[1.95] text-cv-muted-fg sm:text-[15px]">
                平时把实习、项目、校园、科研的经历记进来；要投岗时粘一段 JD，它就从你的
                <strong className="font-bold text-cv-fg">真实经历</strong>
                里挑出最相关的，写成一版对着岗位的简历 —— 还能在线微调、导出 PDF 与 Word。
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={onEnter}>
                开始使用
                <ArrowRight size={17} aria-hidden="true" />
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href="#how">看看它怎么用</a>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
              {['免密钥用 AI', '每个浏览器独立空间', '一键导出备份'].map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-[12.5px] font-medium text-cv-muted-fg">
                  <CheckCircle2 size={14} className="shrink-0 text-cv-ok" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <ResumeSample />
          </Reveal>
        </section>

        {/* ---------- 2. 痛点 → 它怎么做 ---------- */}
        <section className="pb-16 lg:pb-24">
          <Reveal className="mb-8 text-center">
            <SectionLabel pulse={false}>Why it exists</SectionLabel>
            <h2 className="mt-4 font-display text-[1.7rem] font-black leading-tight tracking-tight text-cv-fg sm:text-[2.1rem]">
              求职这件事，卡住的往往不是能力
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {PAINS.map((p, i) => (
              <Reveal key={p.before} delay={i * 90} className="h-full">
                <Card elevation="md" interactive className="flex h-full flex-col p-6">
                  <IconTile icon={Compass} tone={p.tone} size="md" />
                  <p className="mt-4 text-[13px] font-medium leading-relaxed text-cv-muted-fg line-through decoration-cv-muted-fg/40">
                    {p.before}
                  </p>
                  <h3 className="mt-3 font-display text-[1.05rem] font-black leading-snug tracking-tight text-cv-fg">
                    {p.after}
                  </h3>
                  <p className="mt-2.5 text-[13px] font-medium leading-relaxed text-cv-muted-fg">
                    {p.detail.split('**').map((seg, si) =>
                      si % 2 === 1 ? (
                        <strong key={si} className="font-bold text-cv-fg">
                          {seg}
                        </strong>
                      ) : (
                        seg
                      ),
                    )}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- 3. 核心能力 ---------- */}
        <section className="pb-16 lg:pb-24">
          <Reveal className="mb-8 text-center">
            <SectionLabel pulse={false}>What's inside</SectionLabel>
            <h2 className="mt-4 font-display text-[1.7rem] font-black leading-tight tracking-tight text-cv-fg sm:text-[2.1rem]">
              从记下来，到投出去，全在这一个地方
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 80} className="h-full">
                <Card elevation="sm" interactive className="flex h-full flex-col p-5">
                  <IconTile icon={f.icon} tone={f.tone} size="md" interactive />
                  <h3 className="mt-3.5 font-display text-[15px] font-black tracking-tight text-cv-fg">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-cv-muted-fg">
                    {f.desc}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- 4. 使用流程 ---------- */}
        <section id="how" className="scroll-mt-8 pb-16 lg:pb-24">
          <Reveal>
            <ClayPanel tone="violet" className="px-6 py-9 sm:px-10 sm:py-11">
              <div className="text-center">
                <span className="font-display text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/70">
                  How it works
                </span>
                <h2 className="mt-3 font-display text-[1.6rem] font-black leading-tight tracking-tight sm:text-[2rem]">
                  四步，从零到一份能投的简历
                </h2>
              </div>

              <ol className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
                {STEPS.map((s) => (
                  <li key={s.n} className="relative">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/18 font-display text-[15px] font-black tabular-nums backdrop-blur-sm">
                        {s.n}
                      </span>
                      <span className="font-display text-[1.05rem] font-black tracking-tight">
                        {s.title}
                      </span>
                    </div>
                    <p className="mt-3 text-[12.5px] font-medium leading-relaxed text-white/85">
                      {s.desc}
                    </p>
                  </li>
                ))}
              </ol>
            </ClayPanel>
          </Reveal>
        </section>

        {/* ---------- 5. 信任与隐私 ---------- */}
        <section className="pb-16 lg:pb-20">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TRUST.map((t, i) => (
              <Reveal key={t.title} delay={i * 90} className="h-full">
                <Card
                  elevation="sm"
                  tone="accent"
                  className="flex h-full items-start gap-3.5 p-5"
                >
                  <IconTile icon={t.icon} tone="soft" size="sm" className="mt-0.5" />
                  <div className="min-w-0">
                    <h3 className="font-display text-[14px] font-black tracking-tight text-cv-fg">
                      {t.title}
                    </h3>
                    <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-cv-muted-fg">
                      {t.desc}
                    </p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ---------- 6. 收尾 CTA ---------- */}
        <Reveal>
          <section className="relative overflow-hidden rounded-clay-xl border border-white/70 clay-glass-strong px-7 py-11 text-center shadow-clayCard sm:px-12 sm:py-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-cv-accent/15 blur-[70px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -right-12 h-56 w-56 rounded-full bg-cv-pink/15 blur-[70px]"
            />
            <div className="relative">
              <h2 className="font-display text-[1.7rem] font-black leading-tight tracking-tight text-cv-fg sm:text-[2.15rem]">
                先记下第一段经历，
                <br className="hidden sm:block" />
                剩下的交给生职迹
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[14px] font-medium leading-relaxed text-cv-muted-fg sm:text-[15px]">
                不需要注册，不需要配置任何东西。打开就能写，写完就能导出。
              </p>
              <div className="mt-8 flex justify-center">
                <Button size="lg" onClick={onEnter}>
                  进入生职迹
                  <ArrowRight size={17} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </section>
        </Reveal>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-cv-border/70 pt-6">
          <Brand size="sm" />
          <p className="text-[11.5px] font-medium text-cv-muted-fg">
            个人经历库 · AI 简历工作台 · 版式导出
          </p>
        </footer>
      </main>
    </div>
  );
}
