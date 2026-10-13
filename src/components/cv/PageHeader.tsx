import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { SectionLabel } from './Badge';
import { IconTile } from './IconTile';
import { cn } from '@/lib/utils';

/**
 * PageHeader —— 每个页面的统一开头。
 *
 * 结构固定为「眉标 → 衬线大标题 → 一句话说明 → 右侧动作」，
 * 这是全站视觉节奏的锚点：用户扫一眼就知道"我在哪、这页能干什么"。
 *
 * 黏土化细节：
 *   - 标题用 Nunito Black（900）+ 紧字距，圆形字腔放大后很有分量
 *   - 可选的渐变图标球给页面一个"把手"，让页头不是一个纯文字块
 *   - 标题尾词用糖果渐变着色（仅这里允许渐变文字，字号足够大）
 */
export function PageHeader({
  label,
  labelPulse = true,
  icon,
  iconTone = 'violet',
  title,
  accent,
  description,
  actions,
  className,
}: {
  /** 眉标文字，建议英文短词，渲染为 Nunito 大写 */
  label: string;
  labelPulse?: boolean;
  /** 可选：页头左侧的渐变图标球 */
  icon?: LucideIcon;
  iconTone?: 'violet' | 'pink' | 'sky' | 'emerald' | 'amber';
  title: string;
  /** 标题里用糖果渐变着色的尾词 */
  accent?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-6', className)}>
      <div className="flex min-w-0 items-start gap-4">
        {icon && <IconTile icon={icon} tone={iconTone} size="lg" className="mt-1 hidden sm:inline-flex" />}
        <div className="min-w-0">
          <SectionLabel pulse={labelPulse}>{label}</SectionLabel>
          <h1 className="mt-4 font-display text-[2.1rem] font-black leading-[1.1] tracking-tight text-cv-fg sm:text-[2.6rem]">
            {title}
            {accent && (
              <>
                {' '}
                <span className="clay-text-gradient">{accent}</span>
              </>
            )}
          </h1>
          {description && (
            <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-cv-muted-fg sm:text-[15px]">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
