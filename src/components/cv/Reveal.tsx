import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reveal —— 入场动画。
 *
 * 实现取舍：设计系统原文用 Framer Motion。这里改用
 * 「IntersectionObserver + CSS 过渡」自己实现，原因是本项目只需要
 * fadeInUp + 错峰两件事，为此引入一个 100KB+ 的运行时（还会拖慢
 * 首屏）不划算；纯 CSS 方案同样完整支持 prefers-reduced-motion，
 * 并且零新增依赖、零运行时开销。
 *
 * 用法：只包裹"页面级区块"（页头 / 统计带 / 工具栏 / 列表容器），
 * 不要包裹列表里的每一项——否则搜索筛选时每一项都会重新播一遍动画。
 */
export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  /** 错峰延迟（毫秒），同一区块内相邻元素建议间隔 60–90ms */
  delay?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 环境不支持（或已被打断）时直接展示最终状态，绝不能把内容留在不可见态
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = Tag as React.ElementType;

  return (
    <Component
      ref={ref}
      data-shown={shown}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined, ...rest.style }}
      className={cn('cv-reveal', className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
