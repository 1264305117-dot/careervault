import {
  BookOpenText,
  Database,
  FileUp,
  Files,
  House,
  MessageCircleQuestion,
  SquarePen,
  Target,
  type LucideIcon,
} from 'lucide-react';

/**
 * 全站视图标识。
 *   landing  产品介绍首页（不套 AppShell，见 views/LandingView）
 *   editor   简历编辑（由简历列表进入，不在导航里出现）
 */
export type View =
  | 'landing'
  | 'dashboard'
  | 'add'
  | 'import'
  | 'match'
  | 'resumes'
  | 'editor'
  | 'interview'
  | 'data';

export interface NavItem {
  key: View;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** 分组标题，渲染为等宽大写小字 */
  label: string;
  items: NavItem[];
}

/**
 * 首页入口。刻意**不放进 NAV_GROUPS**：三个分组讲的是"用得越久越顺"的
 * 工作流（沉淀 → 产出 → 系统），而首页是产品门面，性质不同。
 * 它是导航板最上面一个独立按钮，任何时候点一下都能回到介绍页。
 */
export const HOME_ITEM: NavItem = { key: 'landing', label: '产品首页', icon: House };

/**
 * 导航按「用户的心智阶段」分组，而不是按功能罗列：
 * 先沉淀经历 → 再产出求职材料 → 最后是系统级设置。
 * 分组本身就在告诉用户这个产品的使用方法。
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: '经历沉淀',
    items: [
      { key: 'dashboard', label: '经历总览', icon: BookOpenText },
      { key: 'add', label: '记录经历', icon: SquarePen },
      { key: 'import', label: '导入简历', icon: FileUp },
    ],
  },
  {
    label: '求职产出',
    items: [
      { key: 'match', label: '岗位匹配', icon: Target },
      { key: 'resumes', label: '我的简历', icon: Files },
      { key: 'interview', label: '面试准备', icon: MessageCircleQuestion },
    ],
  },
  {
    label: '系统',
    items: [{ key: 'data', label: '数据备份', icon: Database }],
  },
];
