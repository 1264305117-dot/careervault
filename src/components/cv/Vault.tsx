import { Check, FolderOpen, Loader2, Pencil, Plus, Trash2, UserRound, Users } from 'lucide-react';
import type { Vault } from '@/types/experience';
import { Button } from './Button';
import { SectionTitle } from './Field';
import { cn } from '@/lib/utils';

/**
 * VaultSwitcher —— 经历库切换器。
 *
 * 经历库 = 一个人的完整工作区（他的经历 + 他生成的简历）。
 * 用户会帮朋友建库，所以「现在在看谁的库」必须是界面上随时可见、随时可切的状态，
 * 而不是一个藏在设置里的开关。
 *
 * 两个形态，职责不重叠：
 *   panel  经历总览页用：完整管理（切换 / 新建 / 重命名 / 删除），每个库带内容计数
 *   bar    侧边栏用：只做「看一眼 + 切一下」，管理动作留给 panel，避免两处重复
 *
 * 删除的口径（v1.5.1）：卡片右上角一个垃圾桶图标 = 一键删除，不弹确认框。
 * 敢这么做是因为删除不是"抹掉"——后端会把整库快照写进本机回收站，
 * 底部弹撤销条（10 秒），事后还能在「数据备份」页找回。
 * 唯一的硬约束是**至少留一个库**，此时删除按钮直接禁用。
 */

export interface VaultSwitcherProps {
  vaults: Vault[];
  currentId: number | null;
  onSwitch: (id: number) => void;
  onCreate: () => void;
  /** 管理动作只在 panel 形态用得到；bar 形态（侧边栏）可以不给 */
  onRename?: (v: Vault) => void;
  onDelete?: (v: Vault) => void;
  /** 切换时的加载态（切库要重新拉数据） */
  busy?: boolean;
  className?: string;
}

function OwnerTag({ vault, onPanel }: { vault: Vault; onPanel?: boolean }) {
  if (!vault.owner) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[10.5px] font-extrabold',
        onPanel ? 'bg-white/20 text-white' : 'bg-cv-accent/10 text-cv-accent',
      )}
    >
      <UserRound size={11} strokeWidth={2.8} aria-hidden="true" />
      {vault.owner}
    </span>
  );
}

/* ---------------- 经历总览页：完整面板 ---------------- */
function VaultPanel({
  vaults,
  currentId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  busy,
  className,
}: VaultSwitcherProps) {
  const onlyOne = vaults.length <= 1;

  return (
    <div className={cn('rounded-clay-lg border border-white/60 clay-glass p-6 shadow-clayCard', className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <FolderOpen size={17} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
            经历库
          </span>
        </SectionTitle>
        <div className="flex shrink-0 items-center gap-2">
          {busy && (
            <span className="inline-flex items-center gap-1.5 font-display text-[11.5px] font-extrabold text-cv-accent">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              切换中
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={onCreate}>
            <Plus size={15} strokeWidth={2.8} aria-hidden="true" />
            新建经历库
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {vaults.map((v) => {
          const active = v.id === currentId;
          return (
            <div
              key={v.id}
              className={cn(
                'group relative rounded-clay border transition-all duration-300 ease-out',
                active
                  ? 'border-white/70 bg-gradient-to-br from-cv-accent-2 via-cv-accent to-[#6D28D9] text-white shadow-clayButton'
                  : 'border-white/60 bg-white/55 shadow-claySoft hover:-translate-y-1 hover:shadow-clayCard',
              )}
            >
              <button
                type="button"
                onClick={() => !active && onSwitch(v.id)}
                aria-pressed={active}
                className="flex w-full cursor-pointer items-start gap-3 rounded-clay p-4 pr-12 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
              >
                <span
                  className={cn(
                    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm',
                    active
                      ? 'bg-white/25 text-white'
                      : 'bg-cv-accent/10 text-cv-accent shadow-claySoft',
                  )}
                  aria-hidden="true"
                >
                  {v.owner && v.owner !== '我' ? (
                    <Users size={17} strokeWidth={2.6} />
                  ) : (
                    <FolderOpen size={17} strokeWidth={2.6} />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'truncate font-display text-[14.5px] font-extrabold tracking-tight',
                        active ? 'text-white' : 'text-cv-fg',
                      )}
                      title={v.name}
                    >
                      {v.name}
                    </span>
                    {active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 font-display text-[10px] font-extrabold text-white">
                        <Check size={10} strokeWidth={3.4} aria-hidden="true" />
                        当前
                      </span>
                    )}
                    <OwnerTag vault={v} onPanel={active} />
                  </span>
                  <span
                    className={cn(
                      'mt-1.5 block font-display text-[11.5px] font-bold',
                      active ? 'text-white/85' : 'text-cv-muted-fg',
                    )}
                  >
                    {v.experiences} 段经历 · {v.resumes} 份简历
                  </span>
                </span>
              </button>

              {/*
                一键删除：**每张卡片都有**，不用先切到那个库再删
                （帮朋友建的库丢在那里，切换过去再删是很别扭的路径）。
                点一下即生效——不弹确认框，因为后端已把整库快照存进本机回收站，
                底部会出现 10 秒撤销条，事后也还能在「数据备份」页找回。
              */}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(v)}
                  disabled={onlyOne}
                  aria-label={`删除经历库：${v.name}`}
                  title={
                    onlyOne
                      ? '至少保留一个经历库，新建一个库之后就可以删了'
                      : `删除「${v.name}」（${v.experiences} 段经历 · ${v.resumes} 份简历）——会移入回收站，可撤销`
                  }
                  className={cn(
                    'absolute right-2.5 top-2.5 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30 disabled:cursor-not-allowed disabled:opacity-35',
                    active
                      ? 'bg-white/20 text-white hover:bg-white/40'
                      : 'bg-white/80 text-cv-muted-fg shadow-claySoft hover:-translate-y-0.5 hover:bg-cv-danger hover:text-white',
                  )}
                >
                  <Trash2 size={14} strokeWidth={2.8} aria-hidden="true" />
                </button>
              )}

              {/* 管理动作：重命名只对"正在看的这个库"有意义，所以只在激活卡片上出现 */}
              {active && onRename && (
                <div className="flex items-center gap-1 px-3 pb-3">
                  <button
                    type="button"
                    onClick={() => onRename(v)}
                    title="重命名这个经历库"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 font-display text-[11px] font-extrabold text-white transition-colors duration-200 hover:bg-white/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
                  >
                    <Pencil size={11} strokeWidth={3} aria-hidden="true" />
                    重命名
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onlyOne && (
        <p className="mt-3.5 text-[11px] font-medium text-cv-muted-fg">
          至少保留一个经历库，所以现在不能删除；新建一个库之后就可以删了。
          删除是一键生效的，但整库会先移入本机回收站，可以随时撤销或在「数据备份」页找回。
        </p>
      )}
    </div>
  );
}

/* ---------------- 侧边栏：紧凑条 ---------------- */
function VaultBar({
  vaults,
  currentId,
  onSwitch,
  onCreate,
  className,
}: VaultSwitcherProps) {
  return (
    <div className={cn('rounded-lg border border-white/70 bg-white/70 p-3 shadow-claySoft', className)}>
      <div className="flex items-center gap-2">
        <FolderOpen size={13} strokeWidth={2.8} aria-hidden="true" className="shrink-0 text-cv-accent" />
        <span className="font-display text-[11px] font-extrabold text-cv-fg">经历库</span>
        <button
          type="button"
          onClick={onCreate}
          title="新建经历库（帮朋友建库）"
          aria-label="新建经历库"
          className="ml-auto inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/80 text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
        >
          <Plus size={13} strokeWidth={3} aria-hidden="true" />
        </button>
      </div>

      <div className="relative mt-2">
        <select
          aria-label="切换经历库"
          value={currentId ?? ''}
          onChange={(e) => onSwitch(Number(e.target.value))}
          className="w-full cursor-pointer appearance-none rounded-md border-0 bg-cv-surface/90 py-2 pl-3 pr-8 font-display text-[12.5px] font-extrabold text-cv-fg shadow-clayPressedSm transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/25"
        >
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cv-accent"
        >
          <path
            d="M6 9l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function VaultSwitcher({ variant = 'panel', ...props }: VaultSwitcherProps & { variant?: 'panel' | 'bar' }) {
  return variant === 'bar' ? <VaultBar {...props} /> : <VaultPanel {...props} />;
}
