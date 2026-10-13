import { Check } from 'lucide-react';
import type { ResumeTemplate } from '@/types/experience';
import { RESUME_TEMPLATES, type TemplateMeta } from '@/lib/resume-templates';
import { cn } from '@/lib/utils';

/**
 * 版式模板选择器。
 *
 * 每个选项配一张**示意图**：四套版式的差别主要落在「页头形态 + 分区标题形态」上，
 * 光看名字（经典/色带/时间轴/醒目）分不清，画出来一眼就懂。
 * 示意图用主色 + 灰条抽象表达，不是真实排版缩略图——真实效果在右侧纸张上即时可见。
 */

function Thumb({ meta }: { meta: TemplateMeta }) {
  const line = (w: string, key: number, opacity = 1) => (
    <span
      key={key}
      className="block h-[3px] rounded-full"
      style={{ width: w, background: '#D9D3E3', opacity }}
    />
  );

  if (meta.header === 'band') {
    return (
      <div className="h-full w-full rounded-md bg-white p-1.5">
        <div
          className="flex items-center gap-1 rounded-[3px] px-1.5 py-1.5"
          style={{ background: meta.accent }}
        >
          <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-white/40" />
          <span className="flex-1 space-y-[3px]">
            <span className="block h-[3px] w-3/4 rounded-full bg-white/90" />
            <span className="block h-[2px] w-1/2 rounded-full bg-white/60" />
          </span>
        </div>
        <div className="mt-1.5 space-y-[3px]">
          <span className="block h-[5px] w-1/3 rounded-[2px]" style={{ background: meta.accent }} />
          {line('100%', 1)}
          {line('85%', 2)}
          <span className="mt-1 block h-[5px] w-1/4 rounded-[2px]" style={{ background: meta.accent }} />
          {line('90%', 3)}
        </div>
      </div>
    );
  }

  if (meta.header === 'left' || meta.header === 'big') {
    const big = meta.header === 'big';
    return (
      <div className="flex h-full w-full gap-1.5 rounded-md bg-white p-1.5">
        <span className="h-full w-[3px] shrink-0 rounded-full" style={{ background: meta.accent }} />
        <span className="min-w-0 flex-1 space-y-[3px]">
          <span
            className="block rounded-[2px]"
            style={{ background: meta.accent, height: big ? 7 : 5, width: big ? '85%' : '65%' }}
          />
          <span className="block h-[2px] w-1/2 rounded-full" style={{ background: '#D9D3E3' }} />
          <span className="!mt-2 block h-[4px] w-1/3 rounded-[1px]" style={{ background: meta.accent }} />
          {line('100%', 1)}
          {line('78%', 2)}
          <span className="!mt-1.5 block h-[4px] w-1/4 rounded-[1px]" style={{ background: meta.accent }} />
          {line('92%', 3)}
        </span>
      </div>
    );
  }

  // formal：黑白一栏式 —— 姓名居中于轴线 + 右上角证件照 + 分区标题下细黑线
  // （页头本身不画通栏黑线：证件照下面压一道线会把纸面切得不对称）
  if (meta.id === 'formal') {
    return (
      <div className="relative h-full w-full rounded-md bg-white p-1.5">
        <span className="absolute right-1.5 top-1.5 h-[15px] w-[11px] rounded-[1px] bg-slate-300" />
        <span className="block space-y-[3px] pt-[3px]">
          <span className="mx-auto block h-[5px] w-1/2 rounded-full" style={{ background: meta.accent }} />
          <span className="mx-auto block h-[2px] w-1/3 rounded-full" style={{ background: '#D9D3E3' }} />
        </span>
        <span className="mt-2 block space-y-[3px]">
          <span className="block h-[3px] w-1/3 rounded-full" style={{ background: meta.accent }} />
          <span className="block h-[2px] w-full rounded-full" style={{ background: meta.accent, opacity: 0.5 }} />
          {line('100%', 1)}
          {line('80%', 2)}
        </span>
        <span className="mt-2 block space-y-[3px]">
          <span className="block h-[3px] w-1/4 rounded-full" style={{ background: meta.accent }} />
          <span className="block h-[2px] w-full rounded-full" style={{ background: meta.accent, opacity: 0.5 }} />
          {line('92%', 3)}
        </span>
      </div>
    );
  }

  // classic
  return (
    <div className="h-full w-full rounded-md bg-white p-1.5">
      <span className="mx-auto block h-[5px] w-1/2 rounded-full" style={{ background: meta.accent }} />
      <span className="mx-auto mt-[3px] block h-[2px] w-1/3 rounded-full" style={{ background: '#D9D3E3' }} />
      <span className="mt-1.5 block h-[2px] w-full rounded-full" style={{ background: meta.accent, opacity: 0.55 }} />
      <span className="mt-1.5 block space-y-[3px]">
        <span className="block h-[3px] w-1/4 rounded-full" style={{ background: meta.accent }} />
        {line('100%', 1)}
        {line('82%', 2)}
      </span>
      <span className="mt-1.5 block h-[2px] w-full rounded-full" style={{ background: meta.accent, opacity: 0.55 }} />
      <span className="mt-1.5 block space-y-[3px]">
        <span className="block h-[3px] w-1/5 rounded-full" style={{ background: meta.accent }} />
        {line('95%', 3)}
      </span>
    </div>
  );
}

export interface TemplatePickerProps {
  value: ResumeTemplate;
  onChange: (id: ResumeTemplate) => void;
  className?: string;
}

export function TemplatePicker({ value, onChange, className }: TemplatePickerProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-5', className)}>
      {RESUME_TEMPLATES.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-clay border p-3 text-left transition-all duration-300 ease-out',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
              active
                ? 'border-transparent bg-white/85 shadow-clayCard'
                : 'border-white/60 bg-white/45 shadow-claySoft hover:-translate-y-1 hover:shadow-clayCard',
            )}
            style={active ? { boxShadow: `0 0 0 2.5px ${t.accent}, var(--sh-card)` } : undefined}
          >
            <span className="block h-[4.6rem] w-[3.2rem] shrink-0 overflow-hidden rounded-md border border-cv-border/70 bg-white">
              <Thumb meta={t} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span
                  className="truncate font-display text-[13px] font-extrabold"
                  style={{ color: active ? t.accent : 'rgb(var(--cv-fg))' }}
                >
                  {t.name}
                </span>
                {active && (
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: t.accent }}
                  >
                    <Check size={10} strokeWidth={3.6} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[11px] font-medium leading-snug text-cv-muted-fg">
                {t.tagline}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
