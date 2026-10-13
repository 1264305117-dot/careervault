/**
 * 过渡期样式垫片。
 *
 * 历史上这里是手写的原子类字符串。现在改为**从设计系统原语派生**，
 * 于是尚未迁移到 `<Button>` / `<Card>` 等组件的页面，
 * 也能立刻拿到统一的黏土材质（凸起/凹陷/玻璃面），不会出现"改了一半"的割裂。
 *
 * 下一轮全站铺开后，本文件的类名字符串会被组件用法取代，届时整体删除。
 * 新增代码请直接使用 `@/components/cv`，不要再扩展这里。
 */
import { buttonVariants, cardVariants, inputVariants } from '@/components/cv';
import { cn } from '@/lib/utils';

/** 主按钮：紫罗兰渐变。每屏最多一个 */
export const BTN_PRIMARY = cn(buttonVariants({ variant: 'primary' }));
/** 实心炭黑按钮：与主按钮并列的强动作 */
export const BTN_ACCENT = cn(buttonVariants({ variant: 'dark' }));
/** 白黏土按钮：次级动作 */
export const BTN_GHOST = cn(buttonVariants({ variant: 'secondary' }));
/** 输入/多行文本共用配方（min-height 保证 input 有 48px，textarea 可自由增高） */
export const INPUT = cn(inputVariants({ size: 'md' }), 'py-3');
/** 卡片：玻璃黏土 + 标准悬浮阴影 */
export const CARD = cn(cardVariants({ elevation: 'md' }));

export type ToastKind = 'ok' | 'err';
export type ToastFn = (kind: ToastKind, text: string) => void;
