import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { IconTile } from './IconTile';
import { cn } from '@/lib/utils';

/**
 * EmptyState —— 空态。
 *
 * 空态是最容易被忽视、却最能体现"有没有认真做"的地方：
 * 一颗悬浮的渐变黏土球 + 一句明确的下一步，而不是一行灰字。
 * 球用 clay-float 缓慢上下浮动，让"空"这件事也有生气。
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  tone = 'violet',
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: 'violet' | 'pink' | 'sky' | 'emerald' | 'amber';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-clay-lg border-2 border-dashed border-cv-accent/25 bg-white/45 px-8 py-16 text-center backdrop-blur-sm',
        className,
      )}
    >
      {/* 顶部环境光：让空态也有"空间感" */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-cv-accent/[0.12] blur-[70px]"
      />
      <div className="relative mx-auto flex flex-col items-center">
        <IconTile icon={icon} tone={tone} size="xl" shape="circle" className="animate-clay-float" />
        <h3 className="mt-6 font-display text-2xl font-black tracking-tight text-cv-fg">{title}</h3>
        {description && (
          <p className="mt-2.5 max-w-md text-sm font-medium leading-relaxed text-cv-muted-fg">
            {description}
          </p>
        )}
        {actions && <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
