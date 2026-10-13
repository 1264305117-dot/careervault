import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Orb —— 统计球。
 *
 * 这是本设计系统里唯一允许的"纯圆形"元素：圆球在黏土世界里代表最轻、
 * 最容易被拿起来的东西。用在概览数字上，天然比方形统计卡更讨喜，
 * 而且圆形排成一行时不会产生"表格感"。
 *
 * 两种语境：
 *   默认        浅色表面上 → 白玻璃球 + 深色数字
 *   onPanel     彩色渐变面板上 → 白玻璃球 + 白字，激活时反转为实心白 + 紫字
 */
const TONES = {
  violet: 'text-cv-accent',
  pink: 'text-cv-pink',
  sky: 'text-cv-sky',
  emerald: 'text-cv-ok',
  amber: 'text-cv-warn',
} as const;

export type OrbTone = keyof typeof TONES;

export interface OrbProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  /** 球中央的大数字 */
  value: React.ReactNode;
  /** 球下方的说明文字 */
  label: string;
  icon?: LucideIcon;
  tone?: OrbTone;
  active?: boolean;
  /** 放在彩色渐变面板上时置 true */
  onPanel?: boolean;
  /** 静态展示（不可点击）时用 <span> 渲染，避免出现无意义的按钮 */
  as?: 'button' | 'span';
}

export function Orb({
  value,
  label,
  icon: Icon,
  tone = 'violet',
  active = false,
  onPanel = false,
  as = 'button',
  className,
  ...props
}: OrbProps) {
  const Comp = as === 'span' ? 'span' : 'button';

  return (
    <Comp
      {...(as === 'button'
        ? { type: 'button' as const, 'aria-pressed': active, ...props }
        : { ...props })}
      className={cn(
        'group/orb flex shrink-0 flex-col items-center justify-center rounded-full',
        'h-[5.5rem] w-[5.5rem] transition-all duration-300 ease-out',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60',
        as === 'button' && 'cursor-pointer hover:-translate-y-1 hover:scale-105',
        onPanel
          ? cn(
              'backdrop-blur-sm',
              active
                ? 'animate-clay-breathe bg-white text-cv-accent shadow-[0_12px_28px_rgb(0_0_0_/_0.22),inset_4px_4px_9px_rgb(255_255_255_/_0.9),inset_-4px_-4px_9px_rgb(0_0_0_/_0.07)]'
                : 'bg-white/18 text-white shadow-[inset_3px_3px_8px_rgb(255_255_255_/_0.2),inset_-3px_-3px_8px_rgb(0_0_0_/_0.1)] hover:bg-white/28',
            )
          : cn(
              'bg-white/85 shadow-clayOrb',
              active ? 'animate-clay-breathe ring-4 ring-cv-accent/35' : 'hover:shadow-clayCard',
            ),
        className,
      )}
    >
      <span
        className={cn(
          'font-display text-[1.75rem] font-black leading-none tabular-nums',
          !onPanel && TONES[tone],
          onPanel && !active && 'text-white',
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          'mt-1 flex items-center gap-1 font-display text-[10.5px] font-extrabold uppercase tracking-[0.1em]',
          onPanel ? (active ? 'text-cv-accent/80' : 'text-white/75') : 'text-cv-muted-fg',
        )}
      >
        {Icon && <Icon size={11} strokeWidth={2.6} aria-hidden="true" />}
        {label}
      </span>
    </Comp>
  );
}
