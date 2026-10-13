import { ChevronDown, Menu, Route, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, StatusDot, VaultSwitcher, inputVariants } from '@/components/cv';
import { HOME_ITEM, NAV_GROUPS, type NavItem, type View } from './nav';
import type { Vault } from '@/types/experience';
import type { CloudModel } from '@/lib/ai';
import { cn } from '@/lib/utils';

/**
 * Sidebar —— 浮起的黏土导航面板。
 *
 * 黏土化改造要点（相对上一版 Minimalist Modern 的深色反转栏）：
 *   1. 导航不再"贴边"，而是一块带内边距、四角大圆角的独立黏土板浮在画布上，
 *      与内容区之间有明确的空气感 —— 这是这套风格的空间语言
 *   2. 材质从"深色反白"改为"玻璃黏土"：半透明白 + 背景模糊，
 *      于是身后的紫/粉/蓝光斑会隐隐透上来，导航栏本身也在呼吸
 *   3. 激活项是一枚**凸起**的紫色渐变胶囊（带自身颜色的投影），
 *      而不是一块深色底 —— 选中这件事在黏土世界里等于"鼓出来"
 *
 * 桌面端固定显示，移动端收进顶栏按钮打开的抽屉。
 */

export interface AiEngineProps {
  status: { ok: boolean; reason: string } | null;
  models: CloudModel[];
  model: string;
  checking: boolean;
  /** 云服务主机名，仅用于 tooltip 说明来源 */
  host: string;
  onRetry: () => void;
  onModelChange: (id: string) => void;
}

export interface SidebarProps {
  view: View;
  onNavigate: (v: View) => void;
  ai: AiEngineProps;
  /** 经历库：当前正在看谁的库，以及切换 / 新建入口（常驻可见，避免"在看朋友的数据"而不自知） */
  vault: {
    vaults: Vault[];
    currentId: number | null;
    onSwitch: (id: number) => void;
    onCreate: () => void;
  };
}

/**
 * 品牌标识。整块是一个按钮 —— 点它回产品首页（LandingView），
 * 这是"回到门面"最自然的动作，不需要额外的导航项去承担。
 */
function Brand({ onHome }: { onHome?: () => void }) {
  return (
    <button
      type="button"
      onClick={onHome}
      title="回到产品首页"
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-md text-left',
        'transition-transform duration-200 hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
      )}
    >
      <span
        className={cn(
          'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          'bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton',
        )}
      >
        <Route size={17} strokeWidth={2.6} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[16.5px] font-black leading-tight tracking-tight text-cv-fg">
          生职迹
        </span>
        <span className="mt-[2px] block font-display text-[9px] font-extrabold uppercase tracking-[0.16em] text-cv-muted-fg/80">
          Career Trail
        </span>
      </span>
    </button>
  );
}

function NavList({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  // 编辑简历属于"我的简历"的子页面，导航上仍然高亮父级，避免出现"没有任何一项选中"的迷失感
  const activeKey: View = view === 'editor' ? 'resumes' : view;

  /** 单个导航项的渲染，首页按钮与分组项共用同一套样式 */
  const renderItem = (item: NavItem) => {
    const active = activeKey === item.key;
    const Icon = item.icon;
    return (
      <li key={item.key}>
        <button
          type="button"
          onClick={() => onNavigate(item.key)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'group flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-all duration-200 ease-out',
            'font-display font-bold',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
            active
              ? 'bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton'
              : 'text-cv-muted-fg hover:-translate-y-0.5 hover:bg-white/70 hover:text-cv-fg hover:shadow-claySoft',
          )}
        >
          <span
            className={cn(
              'inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-sm transition-transform duration-300',
              active ? 'bg-white/25' : 'group-hover:scale-110',
            )}
          >
            <Icon size={15} strokeWidth={2.6} aria-hidden="true" />
          </span>
          <span className="truncate">{item.label}</span>
        </button>
      </li>
    );
  };

  return (
    <nav aria-label="主导航" className="space-y-3.5">
      <ul className="space-y-0.5">{renderItem(HOME_ITEM)}</ul>

      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-2.5 pb-1 font-display text-[9px] font-extrabold uppercase tracking-[0.18em] text-cv-muted-fg/70">
            {group.label}
          </div>
          <ul className="space-y-0.5">{group.items.map(renderItem)}</ul>
        </div>
      ))}
    </nav>
  );
}

/** AI 引擎状态卡：让"现在用的是哪个模型"始终可见 */
function AiEngineCard({ ai }: { ai: AiEngineProps }) {
  const tone = ai.status === null ? 'idle' : ai.status.ok ? 'ok' : 'warn';
  const state = ai.status === null ? 'CHECKING' : ai.status.ok ? 'ONLINE' : 'FALLBACK';

  return (
    <div className="rounded-lg border border-white/70 bg-white/70 p-3 shadow-claySoft">
      <div className="flex items-center gap-2">
        <StatusDot tone={tone} pulse={tone !== 'idle'} />
        <span className="font-display text-[12.5px] font-extrabold text-cv-fg">AI 引擎</span>
        <span className="ml-auto font-display text-[9px] font-extrabold uppercase tracking-[0.16em] text-cv-muted-fg/80">
          {state}
        </span>
      </div>

      <p className="mt-1.5 text-[11px] font-medium leading-snug text-cv-muted-fg">
        {ai.status === null
          ? '正在检测云端连接…'
          : ai.status.ok
            ? '云端大模型已就绪'
            : '云端不可用，已切到本地保底'}
      </p>

      {ai.status?.ok ? (
        <div className="relative mt-2.5">
          <select
            aria-label="选择云端模型"
            title={`由 WorkBuddy 云服务提供（${ai.host}），无需自备 API Key`}
            value={ai.model}
            onChange={(e) => ai.onModelChange(e.target.value)}
            className={cn(
              inputVariants({ size: 'sm' }),
              'cursor-pointer appearance-none py-1.5 pl-3 pr-8 font-semibold',
            )}
          >
            {ai.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cv-accent"
          />
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="mt-2.5 w-full px-3"
          loading={ai.checking}
          onClick={ai.onRetry}
        >
          {ai.checking ? '连接中' : '重试连接云端'}
        </Button>
      )}

      {ai.status && !ai.status.ok && ai.status.reason && (
        <p className="mt-1.5 text-[10px] font-medium leading-snug text-cv-warn">{ai.status.reason}</p>
      )}

      <p className="mt-2.5 border-t border-cv-border/70 pt-2 font-display text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-cv-muted-fg/60">
        免密钥 · WorkBuddy 云服务
      </p>
    </div>
  );
}

export function Sidebar({ view, onNavigate, ai, vault }: SidebarProps) {
  const [open, setOpen] = useState(false);

  // Esc 关闭抽屉；打开时锁住背景滚动
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const navigate = (v: View) => {
    onNavigate(v);
    setOpen(false);
  };

  return (
    <>
      {/* ---------- 移动端顶栏：同样是浮起的黏土板 ---------- */}
      <header className="sticky top-0 z-30 px-4 pt-4 lg:hidden">
        <div className="flex items-center gap-3 rounded-lg border border-white/70 clay-glass-strong px-3.5 py-3 shadow-clayCard">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="打开导航菜单"
            aria-expanded={open}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-white/70 bg-white/80 text-cv-fg shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
          >
            <Menu size={18} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <span className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('landing')}
              className="flex cursor-pointer items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-claySoft">
                <Route size={15} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <span className="truncate font-display text-[16px] font-black tracking-tight text-cv-fg">
                生职迹
              </span>
            </button>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <StatusDot tone={ai.status === null ? 'idle' : ai.status.ok ? 'ok' : 'warn'} />
            <span className="font-display text-[9px] font-extrabold uppercase tracking-[0.16em] text-cv-muted-fg">
              {ai.status === null ? 'CHECKING' : ai.status.ok ? 'ONLINE' : 'LOCAL'}
            </span>
          </span>
        </div>
      </header>

      {/* ---------- 桌面端：浮动的独立黏土板 ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[16.5rem] p-3.5 lg:block">
        <div className="flex h-full flex-col overflow-hidden rounded-clay-xl border border-white/70 clay-glass shadow-clayCard">
          <div className="px-4 pb-3 pt-5">
            <Brand onHome={() => navigate('landing')} />
          </div>

          <div className="px-2.5 pb-2.5">
            <VaultSwitcher variant="bar" {...vault} />
          </div>

          <div className="cv-scroll flex-1 overflow-y-auto px-2.5 pb-3">
            <NavList view={view} onNavigate={navigate} />
          </div>

          <div className="m-2.5 mt-0">
            <AiEngineCard ai={ai} />
          </div>
        </div>
      </aside>

      {/* ---------- 移动端抽屉 ---------- */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="导航菜单">
          <div
            className="absolute inset-0 animate-fade-in bg-cv-ink/35 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[88vw] animate-drawer-in p-3.5">
            <div className="flex h-full flex-col overflow-hidden rounded-clay-xl border border-white/70 clay-glass-strong shadow-clayCard">
              <div className="flex items-center justify-between px-4 pb-3 pt-5">
                <Brand onHome={() => navigate('landing')} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="关闭导航菜单"
                  className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-white/70 bg-white/80 text-cv-muted-fg shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 hover:text-cv-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                >
                  <X size={16} strokeWidth={2.6} aria-hidden="true" />
                </button>
              </div>
              <div className="px-2.5 pb-2.5">
                <VaultSwitcher variant="bar" {...vault} />
              </div>
              <div className="cv-scroll flex-1 overflow-y-auto px-2.5 pb-3">
                <NavList view={view} onNavigate={navigate} />
              </div>
              <div className="m-2.5 mt-0">
                <AiEngineCard ai={ai} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
