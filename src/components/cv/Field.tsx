import { cva, type VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Field —— 表单原语（Input / Textarea / Select / FieldLabel）。
 *
 * 物理表达：输入框是**凹陷**的 —— inset 阴影在左上压出深度、右下勾出唇边高光，
 * 像被手指按进黏土里的槽。聚焦时整块"弹"成白色凸起面 + 一圈薰衣草色光环，
 * 状态切换本身就是一次触感反馈。
 *
 * 高度用 min-h 而不是 h：同一个配方给 <input> 44px+ 的触控高度，
 * 套到 <textarea> 上又能随内容自由生长。
 */
export const inputVariants = cva(
  cn(
    'w-full border-0 bg-cv-surface font-medium text-cv-fg shadow-clayPressed',
    'transition-all duration-200 ease-out',
    'placeholder:font-normal placeholder:text-cv-muted-fg/65',
    'hover:bg-[#EAE5F3]',
    'focus-visible:bg-cv-card focus-visible:shadow-claySoft focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25',
    'disabled:cursor-not-allowed disabled:opacity-60',
  ),
  {
    variants: {
      size: {
        sm: 'min-h-10 rounded-sm px-4 text-[13px]',
        md: 'min-h-12 rounded-md px-5 text-sm',
        lg: 'min-h-14 rounded-md px-6 text-[15px]',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

/** 多行：高度自适应，不显示拖拽手柄（长文本靠自动增高） */
export const textareaClass = cn(
  inputVariants({ size: 'md' }),
  'resize-none py-3 leading-relaxed',
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, size, type = 'text', ...props },
  ref,
) {
  return (
    <input ref={ref} type={type} className={cn(inputVariants({ size }), className)} {...props} />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(textareaClass, className)} {...props} />;
});

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** 视觉高度，与 Input 对齐 */
  size?: 'sm' | 'md' | 'lg';
}

/** 原生 select + 自绘箭头：保留系统弹层（移动端体验最好），只统一外观 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, size = 'md', children, ...props },
  ref,
) {
  return (
    <div className="relative inline-flex items-center">
      <select
        ref={ref}
        className={cn(
          inputVariants({ size }),
          'cursor-pointer appearance-none pr-11 font-semibold',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        strokeWidth={3}
        aria-hidden="true"
        className="pointer-events-none absolute right-4 text-cv-accent"
      />
    </div>
  );
});

/** 字段标签：Nunito 粗体小字。黏土风不用等宽字体，靠字重 + 圆润字形做层级 */
export function FieldLabel({
  children,
  hint,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-2 flex items-baseline gap-2 font-display text-[13px] font-extrabold text-cv-fg',
        className,
      )}
    >
      {children}
      {hint && <span className="font-sans font-normal text-cv-muted-fg">{hint}</span>}
    </label>
  );
}

/**
 * SectionTitle —— 卡片内的分节标题。
 * 带一颗渐变小球，把"这一块在讲什么"用一个视觉标记固定下来。
 */
export function SectionTitle({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-cv-accent-2 to-cv-accent shadow-claySoft"
      />
      <span className="font-display text-[15px] font-extrabold text-cv-fg">{children}</span>
    </div>
  );
}
