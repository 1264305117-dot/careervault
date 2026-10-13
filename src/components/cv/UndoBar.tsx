import { useEffect, useRef, useState } from 'react';
import { Loader2, Trash2, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * UndoBar —— 底部撤销条。
 *
 * 为什么不用 toast：删除经历库是**整库级**动作，用户需要一眼看清
 * 「删了什么、里面有多少东西」，并且要有足够时间（10 秒）做决定。
 * 右上角 3 秒就消失的 toast 承担不了这个责任。
 *
 * 它也不是"确认框"的替代品——删除已经生效了，这里只是把后悔权还给用户：
 * 后端把整库快照存进了本机回收站，所以「撤销」是把快照原样插回去。
 * 就算这条撤销条已经消失，数据备份页里仍然找得回来。
 */

export interface UndoBarProps {
  /** 主文案，如「已删除「张伟的经历库」」 */
  message: string;
  /** 次文案，如「3 段经历 · 1 份简历已移入回收站」 */
  hint?: string;
  /** 动作按钮文案，默认「撤销」 */
  actionLabel?: string;
  onAction?: () => void;
  /** 倒计时结束或用户主动关掉时调用 */
  onClose: () => void;
  /** 撤销窗口，默认 10 秒 */
  seconds?: number;
  /** 动作请求进行中（避免重复点） */
  busy?: boolean;
  className?: string;
}

const TICK_MS = 100;

export function UndoBar({
  message,
  hint,
  actionLabel = '撤销',
  onAction,
  onClose,
  seconds = 10,
  busy = false,
  className,
}: UndoBarProps) {
  const [left, setLeft] = useState(seconds);
  // onClose 往往是父组件里的内联函数，每次渲染都是新引用。
  // 直接进依赖数组会让倒计时每 100ms 被重置一次（永远走不完），所以用 ref 兜住。
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    // 用"截止时间"而不是累减，标签页被切到后台导致定时器被节流时，
    // 剩余时间依然是准的（不会出现"进度条走完了但还没关"）。
    const deadline = Date.now() + seconds * 1000;
    const iv = setInterval(() => {
      const rest = Math.max(0, deadline - Date.now());
      setLeft(rest / 1000);
      if (rest <= 0) {
        clearInterval(iv);
        closeRef.current();
      }
    }, TICK_MS);
    return () => clearInterval(iv);
  }, [seconds]);

  const pct = Math.max(0, Math.min(100, (left / seconds) * 100));

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-5',
        className,
      )}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto relative w-full max-w-2xl animate-pop-in overflow-hidden rounded-clay border border-white/70 clay-glass-strong px-5 py-4 shadow-clayCard"
      >
        <div className="flex items-center gap-3.5">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cv-accent-2 to-cv-accent text-white shadow-clayButton"
            aria-hidden="true"
          >
            <Trash2 size={16} strokeWidth={2.8} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[13.5px] font-extrabold text-cv-fg" title={message}>
              {message}
            </div>
            {hint && (
              <div className="mt-0.5 truncate text-[11.5px] font-medium text-cv-muted-fg" title={hint}>
                {hint}
              </div>
            )}
          </div>

          {onAction && (
            <button
              type="button"
              onClick={onAction}
              disabled={busy}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-br from-cv-accent-2 to-cv-accent px-4 py-2 font-display text-[12px] font-extrabold text-white shadow-clayButton transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30 disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Undo2 size={13} strokeWidth={3} aria-hidden="true" />
              )}
              {actionLabel}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭这条提示"
            title="关闭（数据仍在回收站，可在「数据备份」里找回）"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/70 text-cv-muted-fg shadow-claySoft transition-colors duration-200 hover:text-cv-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
          >
            <X size={15} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        {/* 倒计时进度：走完即自动收起（数据仍在回收站，不是删除窗口） */}
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-1 rounded-r-full bg-gradient-to-r from-cv-accent-2 to-cv-accent transition-[width] duration-100 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
