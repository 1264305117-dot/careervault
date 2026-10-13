import {
  BriefcaseBusiness,
  FlaskConical,
  GraduationCap,
  Rocket,
  School,
  Sparkles,
  TriangleAlert,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import { ENGINE_BADGE, type ExpType } from '@/types/experience';
import { cn } from '@/lib/utils';

/**
 * Badge —— 标签类原语（黏土胶囊）。
 *
 * 色彩策略：类型辨认交给**一颗小渐变球**（面积最小、色相最饱和），
 * 文字始终是深炭色。这样页面上可以有五个色相同时出现，
 * 但读起来仍然是"一个干净列表"，而不是五条彩色横幅。
 */
export const TYPE_META: Record<
  ExpType,
  { icon: LucideIcon; orb: string; dot: string; text: string; zh: string; en: string }
> = {
  实习: {
    icon: BriefcaseBusiness,
    orb: 'from-cv-accent-2 to-cv-accent',
    dot: 'bg-cv-accent',
    text: 'text-cv-accent',
    zh: '实习',
    en: 'INTERN',
  },
  项目: {
    icon: Rocket,
    orb: 'from-pink-400 to-pink-600',
    dot: 'bg-pink-500',
    text: 'text-pink-600',
    zh: '项目',
    en: 'PROJECT',
  },
  科研: {
    icon: FlaskConical,
    orb: 'from-sky-400 to-sky-600',
    dot: 'bg-sky-500',
    text: 'text-sky-600',
    zh: '科研',
    en: 'RESEARCH',
  },
  校园: {
    icon: School,
    orb: 'from-indigo-400 to-indigo-600',
    dot: 'bg-indigo-500',
    text: 'text-indigo-600',
    zh: '校园',
    en: 'CAMPUS',
  },
  教育: {
    icon: GraduationCap,
    orb: 'from-amber-400 to-amber-600',
    dot: 'bg-amber-500',
    text: 'text-amber-600',
    zh: '教育',
    en: 'EDUCATION',
  },
  技能: {
    icon: Wrench,
    orb: 'from-emerald-400 to-emerald-600',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600',
    zh: '技能',
    en: 'SKILL',
  },
};

/** 区块标签：每个页面/章节开头的"眉标"，建立视觉节奏与定位感 */
export function SectionLabel({
  children,
  pulse = true,
  className,
}: {
  children: React.ReactNode;
  /** 是否显示呼吸圆点（"在线/进行中"的信号） */
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full border border-white/70 clay-glass-strong px-4 py-1.5 shadow-claySoft',
        className,
      )}
    >
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {pulse && (
          <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-cv-accent" />
        )}
        <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-cv-accent-2 to-cv-accent" />
      </span>
      <span className="font-display text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-cv-accent">
        {children}
      </span>
    </span>
  );
}

/** 经历类型胶囊：白玻璃底 + 一颗类型色渐变球承担辨认 */
export function TypeBadge({
  type,
  withIcon = false,
  className,
}: {
  type: ExpType;
  withIcon?: boolean;
  className?: string;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border border-white/70 clay-glass-strong py-1 pl-1.5 pr-3',
        'font-display text-[11.5px] font-extrabold text-cv-fg shadow-claySoft',
        className,
      )}
    >
      {withIcon ? (
        <span
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-white',
            'shadow-[3px_3px_7px_rgb(124_58_237_/_0.22),inset_2px_2px_4px_rgb(255_255_255_/_0.35)]',
            meta.orb,
          )}
        >
          <Icon size={12} strokeWidth={2.6} aria-hidden="true" />
        </span>
      ) : (
        <span
          className={cn('ml-1 h-2 w-2 rounded-full', meta.dot)}
          aria-hidden="true"
        />
      )}
      {meta.zh}
    </span>
  );
}

/** 通用过滤/标签胶囊 */
export function Chip({
  active = false,
  count,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5',
        'font-display text-[11.5px] font-extrabold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
        active
          ? 'bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton'
          : 'border border-white/70 clay-glass-strong text-cv-muted-fg shadow-claySoft hover:-translate-y-0.5 hover:text-cv-accent',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-cv-muted-fg/70')}>
          {count}
        </span>
      )}
    </button>
  );
}

/** 状态点：AI 引擎健康度、系统状态 */
export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: 'ok' | 'warn' | 'idle';
  pulse?: boolean;
  className?: string;
}) {
  const color = tone === 'ok' ? 'bg-cv-ok' : tone === 'warn' ? 'bg-cv-warn' : 'bg-cv-muted-fg/50';
  return (
    <span className={cn('relative flex h-2.5 w-2.5 shrink-0', className)} aria-hidden="true">
      {pulse && (
        <span className={cn('absolute inline-flex h-full w-full animate-pulse-soft rounded-full', color)} />
      )}
      <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full shadow-claySoft', color)} />
    </span>
  );
}

/** 引擎来源徽章：让用户始终知道这结果是云端大模型还是本地保底 */
export function EngineBadge({ engine, className }: { engine: 'llm' | 'local'; className?: string }) {
  const isLlm = engine === 'llm';
  const { label, title } = ENGINE_BADGE[engine];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-[11px] font-extrabold text-white shadow-claySoft',
        isLlm
          ? 'bg-gradient-to-br from-cv-accent-2 to-cv-accent'
          : 'bg-gradient-to-br from-amber-400 to-amber-600',
        className,
      )}
      title={title}
    >
      {isLlm ? (
        <Sparkles size={12} strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <TriangleAlert size={12} strokeWidth={2.6} aria-hidden="true" />
      )}
      {label}
    </span>
  );
}

/** 纯展示的标签（不可点击），用于经历卡片底部 */
export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full border border-white/70 bg-white/55 px-3 py-1 font-display text-[11px] font-bold text-cv-muted-fg shadow-claySoft"
        >
          {t}
        </span>
      ))}
    </div>
  );
}
