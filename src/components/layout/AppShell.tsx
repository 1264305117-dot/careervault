import type { ReactNode } from 'react';
import { Blobs } from './Blobs';

/**
 * AppShell —— 页面骨架。
 *
 * 职责只有三件事：
 *   1. 铺画布（淡薰衣草白 #F4F1FA）与背景光斑层 —— 平铺纯色是这套风格的禁忌
 *   2. 给浮动的导航板留出空间（lg:pl-[16.5rem]），并统一内容区宽度与留白节奏
 *   3. 移动端不预留空间（导航板此时收进抽屉）
 *
 * 内容区宽度用 max-w-6xl，与设计系统的容器规范一致；
 * 竖向留白 py-8 → lg:py-12，制造从容的滚动节奏。
 */
export function AppShell({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-cv-fg">
      <Blobs />

      {nav}

      <main className="relative lg:pl-[16.5rem]">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-7 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
