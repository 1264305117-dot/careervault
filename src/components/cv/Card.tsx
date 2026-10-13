import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Card —— 内容容器（玻璃黏土）。
 *
 * 材质说明：卡片是「半透明白 + 背景模糊」，让身后的彩色光斑透上来；
 * 不用实心白（会像贴上去的纸片），也不用硬边框（会破坏黏土的柔和）。
 * 结构上的"边"全部交给阴影栈：外投影定义离地高度，白色内边缘光勾出体积。
 *
 * interactive 时 hover 抬升 8px 并放大影子 —— 这是这套风格的核心手感。
 */
export const cardVariants = cva(
  cn('relative border border-white/60 clay-glass', 'transition-all duration-500 ease-out'),
  {
    variants: {
      elevation: {
        flat: 'shadow-none',
        /** 轻：内嵌的小块（工具条、列表里的子面板） */
        sm: 'shadow-claySoft',
        /** 标准悬浮卡片 */
        md: 'shadow-clayCard',
        /** 强：需要被单独注意的卡片 */
        lg: 'shadow-clayCardHover',
      },
      tone: {
        default: '',
        /** 弱化：未选中 / 次要内容 */
        muted: 'bg-white/40',
        /** 强调：AI 相关等需要被注意到、但不抢 CTA 的区块 */
        accent: 'border-white/70 bg-cv-accent/[0.07]',
        /** 虚线：空态 / 占位 */
        dashed: 'border-2 border-dashed border-cv-accent/25 shadow-none',
      },
      radius: {
        lg: 'rounded-clay',
        xl: 'rounded-clay-lg',
        '2xl': 'rounded-clay-xl',
      },
      interactive: {
        true: cn(
          'group cursor-pointer',
          'hover:-translate-y-2 hover:shadow-clayCardHover',
          // 极淡的紫色浮层，hover 时淡入：让"被指到"这件事有回应
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-br after:from-cv-accent/[0.05] after:to-transparent after:opacity-0 after:transition-opacity after:duration-500 after:content-['']",
          'hover:after:opacity-100',
        ),
        false: '',
      },
    },
    defaultVariants: { elevation: 'md', tone: 'default', radius: 'xl', interactive: false },
  },
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, elevation, tone, radius, interactive, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      ref={ref}
      className={cn(cardVariants({ elevation, tone, radius, interactive }), className)}
      {...props}
    />
  );
});

/**
 * ClayPanel —— 彩色凸起面板。
 *
 * 这是本设计系统的"高潮位"：整块高饱和渐变黏土从页面里鼓出来，
 * 靠自身颜色的投影落在地面上。用在统计带、匹配得分、需要被聚焦的单块内容。
 * （替代了上一版 Minimalist Modern 的深色反转区块。）
 */
const panelTones = {
  violet: 'bg-gradient-to-br from-cv-accent-2 via-cv-accent to-[#6D28D9]',
  pink: 'bg-gradient-to-br from-pink-400 via-cv-pink to-[#9D174D]',
  sky: 'bg-gradient-to-br from-sky-400 via-cv-sky to-[#0369A1]',
  ink: 'bg-gradient-to-br from-[#4A4452] via-[#332F3A] to-[#221F26]',
} as const;

export type ClayPanelTone = keyof typeof panelTones;

export const ClayPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { tone?: ClayPanelTone; bloom?: boolean }
>(function ClayPanel({ className, tone = 'violet', bloom = true, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden rounded-clay-xl text-white',
        panelTones[tone],
        // 凸起的投影用面板自身的色相，而不是灰色 —— 这是"糖果"感的关键
        'shadow-[16px_16px_36px_rgb(124_58_237_/_0.32),-10px_-10px_28px_rgb(255_255_255_/_0.75),inset_6px_6px_14px_rgb(255_255_255_/_0.22),inset_-6px_-6px_14px_rgb(0_0_0_/_0.12)]',
        className,
      )}
      {...props}
    >
      {bloom && (
        <>
          {/* 内部光斑：让整块渐变不是死板的线性过渡 */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/25 blur-[80px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-white/10 blur-[80px]"
          />
        </>
      )}
      <div className="relative">{children}</div>
    </div>
  );
});
