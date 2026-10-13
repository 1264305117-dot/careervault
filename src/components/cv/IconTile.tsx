import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * IconTile —— 图标底座（渐变黏土球）。
 *
 * 设计规则：图标**必须**用完整的高饱和渐变底，而不是半透明填充。
 * 渐变球是这套系统里出现频率最高的强色块，也是"糖果店"气质的直接来源。
 * 多个色相交替使用（紫/粉/蓝/绿/琥珀），避免整页只有一种颜色。
 */
const iconTileVariants = cva(
  cn(
    'inline-flex shrink-0 items-center justify-center text-white',
    'shadow-[6px_6px_14px_rgb(124_58_237_/_0.28),-4px_-4px_10px_rgb(255_255_255_/_0.7),inset_3px_3px_6px_rgb(255_255_255_/_0.35),inset_-3px_-3px_6px_rgb(0_0_0_/_0.08)]',
  ),
  {
    variants: {
      tone: {
        /** 默认（沿用旧名）：紫罗兰 */
        gradient: 'bg-gradient-to-br from-cv-accent-2 to-cv-accent',
        violet: 'bg-gradient-to-br from-cv-accent-2 to-cv-accent',
        pink: 'bg-gradient-to-br from-pink-400 to-pink-600',
        sky: 'bg-gradient-to-br from-sky-400 to-sky-600',
        emerald: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
        amber: 'bg-gradient-to-br from-amber-400 to-amber-600',
        /** 弱化：不需要色相的地方（表单小图标） */
        soft: 'bg-cv-surface text-cv-muted-fg shadow-claySoft',
        /** 彩色表面内部使用 */
        glass: 'border border-white/25 bg-white/20 text-white backdrop-blur-sm shadow-none',
      },
      size: {
        sm: 'h-8 w-8 rounded-sm',
        md: 'h-11 w-11 rounded-md',
        lg: 'h-14 w-14 rounded-lg',
        xl: 'h-[68px] w-[68px] rounded-lg',
      },
      shape: {
        squircle: '',
        circle: 'rounded-full',
      },
    },
    defaultVariants: { tone: 'violet', size: 'md', shape: 'squircle' },
  },
);

const ICON_SIZE: Record<'sm' | 'md' | 'lg' | 'xl', number> = { sm: 15, md: 19, lg: 24, xl: 30 };

export interface IconTileProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof iconTileVariants> {
  icon: LucideIcon;
  /** 是否在父级 group hover 时轻微放大 */
  interactive?: boolean;
}

export function IconTile({
  icon: Icon,
  tone,
  size = 'md',
  shape,
  interactive = false,
  className,
  ...props
}: IconTileProps) {
  return (
    <span className={cn(iconTileVariants({ tone, size, shape }), className)} {...props}>
      <Icon
        size={ICON_SIZE[size ?? 'md']}
        strokeWidth={2.4}
        aria-hidden="true"
        className={cn(interactive && 'transition-transform duration-300 group-hover:scale-110')}
      />
    </span>
  );
}
