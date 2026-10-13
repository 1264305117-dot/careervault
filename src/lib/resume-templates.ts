/**
 * 简历版式模板 —— 唯一真源。
 *
 * 这里的每一项都必须与**后端导出**（api/export.py 的 TEMPLATES）一一对应：
 * 本文件决定「编辑器纸张长什么样」，后端决定「导出的 PDF / Word 长什么样」，
 * 两边共用同一套 accent 色值与 header/section 形态，才能保证所见即所得。
 *
 * 皮肤的三个维度：
 *   accent   主色（分区标题、页头强调、时间轴色条）
 *   header   页头形态：center 居中 / band 顶部色带 / left 左对齐 / big 超大姓名
 *   section  分区标题形态：rule 细线 / block 实色块 / bar 左侧色条 / big 大字
 *
 * 数组顺序 = 编辑页模板选择器的展示顺序（formal 排第一，最常用）。
 */
import type { ResumeContent, ResumeTemplate } from '@/types/experience';

export interface TemplateMeta {
  id: ResumeTemplate;
  name: string;
  tagline: string;
  /** 主色（与 api/export.py 中的 accent 保持一致） */
  accent: string;
  /** 主色的浅色版，用于纸张里的柔光块 */
  tint: string;
  header: 'center' | 'band' | 'left' | 'big';
  section: 'rule' | 'block' | 'bar' | 'big';
}

export const RESUME_TEMPLATES: TemplateMeta[] = [
  {
    id: 'formal',
    name: '经典求职',
    tagline: '黑白一栏式，最像纸质简历的稳重版',
    accent: '#111827',
    tint: '#E5E7EB',
    header: 'center',
    section: 'rule',
  },
  {
    id: 'classic',
    name: '经典居中',
    tagline: '墨蓝细线，投国企/金融最稳',
    accent: '#1E3A5F',
    tint: '#E8EDF4',
    header: 'center',
    section: 'rule',
  },
  {
    id: 'band',
    name: '现代色带',
    tagline: '紫罗兰色带页头，信息型选手',
    accent: '#6D28D9',
    tint: '#F1EAFE',
    header: 'band',
    section: 'block',
  },
  {
    id: 'timeline',
    name: '时间轴',
    tagline: '青蓝左色条，经历多时最清晰',
    accent: '#0E7490',
    tint: '#E4F3F6',
    header: 'left',
    section: 'bar',
  },
  {
    id: 'bold',
    name: '醒目大字',
    tagline: '热粉超大姓名，设计/内容岗',
    accent: '#BE185D',
    tint: '#FCE9F1',
    header: 'big',
    section: 'big',
  },
];

export const TEMPLATE_MAP: Record<ResumeTemplate, TemplateMeta> = RESUME_TEMPLATES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ResumeTemplate, TemplateMeta>,
);

/** 读一份简历的模板；老简历（没存过 template）一律回落到经典 */
export function templateOf(content: Pick<ResumeContent, 'template'> | null | undefined): TemplateMeta {
  const id = content?.template;
  return (id && TEMPLATE_MAP[id]) || TEMPLATE_MAP.classic;
}

/**
 * 上次用过的模板。新建 / 新生成的简历沿用它，省得每份都重新选一遍
 * （选过一次「时间轴」的人，通常后面每一份都想用时间轴）。
 */
const PREFERRED_KEY = 'cv_resume_template';

export function loadPreferredTemplate(): ResumeTemplate {
  try {
    const v = localStorage.getItem(PREFERRED_KEY) as ResumeTemplate | null;
    return v && TEMPLATE_MAP[v] ? v : 'classic';
  } catch {
    return 'classic';
  }
}

export function rememberTemplate(id: ResumeTemplate): void {
  try {
    localStorage.setItem(PREFERRED_KEY, id);
  } catch {
    /* 隐私模式下忽略 */
  }
}
