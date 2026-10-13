import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Button —— 设计系统的动作原语（黏土按钮）。
 *
 * 物理表达：默认「凸起」——自身颜色的柔和投影 + 左上高光 + 内边缘光；
 * hover 时整体抬起 4px 并把影子放大（像飘近眼前）；
 * 按下时反向压缩（scale 0.92）并换成 inset 阴影，模拟被捏扁。
 *
 * 层次规则（务必按此选择 variant，否则界面会失去主次）：
 *   primary   紫罗兰渐变。每屏最多 1 个，代表"你接下来该点的那一下"
 *   secondary 白黏土。次级动作，可并列多个
 *   outline   描边。第三级
 *   ghost     无底。工具栏 / 卡片内联动作
 *   dark      炭黑实心。与主按钮并列但不抢焦点
 *   success   翡翠渐变。完成式动作（确认导入、保存简历）
 *   danger    软红。破坏性动作
 */
export const buttonVariants = cva(
  cn(
    'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
    'font-bold tracking-wide',
    'transition-all duration-200 ease-out',
    // 捏扁：位移 + 阴影换成 inset，两件事同时发生才有"物理"感
    'active:scale-[0.92] active:shadow-clayPressed',
    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30 focus-visible:ring-offset-2 focus-visible:ring-offset-cv-bg',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton',
          'hover:-translate-y-1 hover:shadow-clayButtonHover',
        ),
        secondary: cn(
          'clay-glass-strong text-cv-fg shadow-claySoft',
          'hover:-translate-y-1 hover:shadow-clayCard',
        ),
        outline: cn(
          'border-2 border-cv-accent/25 text-cv-accent',
          'hover:-translate-y-1 hover:border-cv-accent hover:bg-cv-accent/[0.07]',
        ),
        ghost: 'text-cv-fg/75 hover:bg-cv-accent/10 hover:text-cv-accent',
        dark: cn('bg-cv-ink text-white shadow-clayButton', 'hover:-translate-y-1 hover:shadow-clayButtonHover'),
        success: cn(
          'bg-gradient-to-br from-emerald-400 to-cv-ok text-white shadow-clayButton',
          'hover:-translate-y-1 hover:shadow-clayButtonHover',
        ),
        danger: cn(
          'border-2 border-cv-danger/25 bg-cv-danger/[0.07] text-cv-danger',
          'hover:-translate-y-1 hover:border-cv-danger/50 hover:bg-cv-danger/[0.13]',
        ),
        /** 彩色表面（渐变面板）内部使用：白玻璃，不引入新的色相 */
        inverted: cn(
          'border border-white/25 bg-white/15 text-white backdrop-blur-sm',
          'hover:-translate-y-1 hover:bg-white/25',
          'focus-visible:ring-offset-cv-accent',
        ),
      },
      size: {
        // 最小 h-11（44px）满足触控目标；icon 档为密集列表里的例外
        sm: 'h-11 rounded-md px-5 text-[13px]',
        md: 'h-12 rounded-md px-6 text-sm',
        lg: 'h-14 rounded-lg px-8 text-base',
        icon: 'h-10 w-10 rounded-sm',
        'icon-sm': 'h-9 w-9 rounded-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** 用子元素承载样式（例如把 <a> 渲染成主按钮） */
  asChild?: boolean;
  /** 加载中：禁用交互并在左侧显示旋转指示器 */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
});
