import { ChevronDown, ChevronUp, ListChecks, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import type { ExpTask } from '@/types/experience';
import { taskHasContent, taskPreview } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { FieldLabel, SectionTitle, inputVariants } from './Field';

/**
 * Task —— 「任务」原语。
 *
 * 一段经历由若干**彼此独立的任务**组成，每个任务各有自己的 情境(S) / 目标(T) /
 * 行动(A) / 结果(R)。这里是这套结构在两个场景下的两副面孔：
 *   - <TaskList>   只读展示：经历卡片、导入解析预览
 *   - <TaskEditor> 可编辑：记录/编辑经历表单
 *
 * 视觉上把四个字母做成四颗不同色相的黏土小球（S 天蓝 / T 琥珀 / A 紫罗兰 / R 翡翠），
 * 复用了设计系统里"用一颗小球承担辨认、文字保持深炭色"的既有手法——
 * 一列任务扫下来是干净的，但每颗球都在告诉你这一行是什么。
 */

const STAR_ROWS = [
  { key: 'star_s', letter: 'S', label: '情境', orb: 'from-sky-400 to-sky-600' },
  { key: 'star_t', letter: 'T', label: '任务', orb: 'from-amber-400 to-amber-600' },
  { key: 'star_a', letter: 'A', label: '行动', orb: 'from-cv-accent-2 to-cv-accent' },
  { key: 'star_r', letter: 'R', label: '结果', orb: 'from-emerald-400 to-emerald-600' },
] as const;

function StarOrb({ letter, orb, className }: { letter: string; orb: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br',
        'font-display text-[10.5px] font-black text-white',
        'shadow-[2px_2px_5px_rgb(124_58_237_/_0.2),inset_1.5px_1.5px_3px_rgb(255_255_255_/_0.35)]',
        orb,
        className,
      )}
    >
      {letter}
    </span>
  );
}

/** 一个任务的 S/T/A/R 四段（只读）。 */
function StarRows({ task, className }: { task: ExpTask; className?: string }) {
  // 本地规则引擎可能让 A 与 R 是同一句，这种重复只渲染一次
  const seen = new Set<string>();
  const rows = STAR_ROWS.map((row) => ({ ...row, value: (task[row.key] || '').trim() })).filter(
    (row) => {
      if (!row.value || seen.has(row.value)) return false;
      seen.add(row.value);
      return true;
    },
  );
  if (rows.length === 0) return null;

  return (
    <dl className={cn('space-y-2', className)}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-start gap-2">
          <StarOrb letter={row.letter} orb={row.orb} className="mt-0.5" />
          <dd
            className={cn(
              'text-[13px] font-medium leading-relaxed text-cv-fg/85',
              row.key === 'star_r' && 'font-semibold text-cv-fg',
            )}
          >
            <span className="mr-1.5 font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-cv-muted-fg">
              {row.label}
            </span>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 一个任务块（只读，四段全摊开）—— 用于导入解析预览：那一步就是要让人逐条校对 */
function TaskCard({ task, index }: { task: ExpTask; index: number }) {
  return (
    <li className="rounded-md border border-white/60 bg-white/55 p-4 shadow-claySoft">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
            'bg-gradient-to-br from-[#8B8398] to-[#5F5870] font-display text-[11px] font-black text-white shadow-claySoft',
          )}
        >
          {index}
        </span>
        <p className="min-w-0 pt-0.5 font-display text-[13.5px] font-extrabold leading-snug text-cv-fg">
          {task.name || '（待命名任务）'}
        </p>
      </div>
      <StarRows task={task} className="mt-2.5 pl-9" />
    </li>
  );
}

/**
 * 任务清单（只读）。
 * `compact` 用于空间紧张的场景（如导入预览）：只显示任务名 + 一句话摘要。
 */
export function TaskList({
  tasks,
  compact = false,
  className,
  title,
}: {
  tasks: ExpTask[];
  compact?: boolean;
  className?: string;
  title?: React.ReactNode;
}) {
  const list = tasks.filter(taskHasContent);
  if (list.length === 0) return null;

  if (compact) {
    return (
      <ul className={cn('space-y-2', className)}>
        {list.map((t, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 rounded-md bg-white/55 px-4 py-3 shadow-claySoft"
          >
            <StarOrb letter={String(i + 1)} orb="from-[#8B8398] to-[#5F5870]" className="mt-0.5" />
            <div className="min-w-0">
              <p className="font-display text-[13px] font-extrabold text-cv-fg">
                {t.name || '（待命名任务）'}
              </p>
              {taskPreview(t) && (
                <p className="mt-0.5 line-clamp-2 text-[12.5px] font-medium leading-relaxed text-cv-muted-fg">
                  {taskPreview(t)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={className}>
      {title && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <ListChecks size={16} strokeWidth={2.6} className="text-cv-accent" aria-hidden="true" />
              {title}
            </span>
          </SectionTitle>
          <span className="rounded-full bg-white/70 px-3 py-1 font-display text-[11px] font-extrabold text-cv-muted-fg shadow-claySoft">
            {list.length} 项任务
          </span>
        </div>
      )}
      <ol className="space-y-3">
        {list.map((t, i) => (
          <TaskCard key={i} task={t} index={i + 1} />
        ))}
      </ol>
    </div>
  );
}

/**
 * 任务清单（手风琴）。
 *
 * 经历卡片默认就用这个形态：**任务标题直接可见**，让"这段经历做了几件事"一眼可读；
 * 每项任务各自折叠，点开才摊开它的 S/T/A/R —— 避免几段文字把卡片撑成一堵墙。
 * 允许多项同时展开，因为在对比两个任务时人会想同时看到两者。
 */
export function TaskAccordion({
  tasks,
  className,
  title = '任务清单',
}: {
  tasks: ExpTask[];
  className?: string;
  title?: string;
}) {
  const list = tasks.filter(taskHasContent);
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  if (list.length === 0) return null;

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className={className}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <ListChecks size={16} strokeWidth={2.6} className="text-cv-accent" aria-hidden="true" />
            {title}
          </span>
        </SectionTitle>
        <span className="rounded-full bg-white/70 px-3 py-1 font-display text-[11px] font-extrabold text-cv-muted-fg shadow-claySoft">
          {list.length} 项 · 点标题看每项 STAR
        </span>
      </div>

      <ol className="space-y-2">
        {list.map((t, i) => {
          const isOpen = open.has(i);
          const preview = taskPreview(t);
          return (
            <li
              key={i}
              className="overflow-hidden rounded-md border border-white/60 bg-white/55 shadow-claySoft"
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
                aria-label={`${isOpen ? '收起' : '展开'}任务 STAR：${t.name || '待命名任务'}`}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left',
                  'transition-colors duration-200 hover:bg-white/75',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
                )}
              >
                <StarOrb letter={String(i + 1)} orb="from-[#8B8398] to-[#5F5870]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[13.5px] font-extrabold leading-snug text-cv-fg">
                    {t.name || '（待命名任务）'}
                  </span>
                  {!isOpen && preview && (
                    <span className="mt-0.5 block truncate text-[12px] font-medium text-cv-muted-fg">
                      {preview}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-cv-muted-fg" aria-hidden="true">
                  {isOpen ? (
                    <ChevronUp size={15} strokeWidth={2.8} />
                  ) : (
                    <ChevronDown size={15} strokeWidth={2.8} />
                  )}
                </span>
              </button>

              {isOpen && <StarRows task={t} className="px-4 pb-4 pl-[50px]" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 任务编辑器：用于「记录经历 / 编辑经历」表单 */
export function TaskEditor({
  tasks,
  onChange,
  className,
}: {
  tasks: ExpTask[];
  onChange: (next: ExpTask[]) => void;
  className?: string;
}) {
  const patch = (index: number, key: keyof ExpTask, value: string) => {
    onChange(tasks.map((t, i) => (i === index ? { ...t, [key]: value } : t)));
  };

  return (
    <div className={cn('space-y-3.5', className)}>
      {tasks.map((task, i) => (
        <div
          key={i}
          className="rounded-md border border-white/60 bg-white/55 p-4 shadow-claySoft sm:p-5"
        >
          <div className="mb-3 flex items-center gap-2.5">
            <StarOrb letter={String(i + 1)} orb="from-[#8B8398] to-[#5F5870]" className="h-6 w-6 text-[11.5px]" />
            <span className="font-display text-[13px] font-extrabold text-cv-fg">
              任务 {i + 1}
            </span>
            <button
              type="button"
              onClick={() => onChange(tasks.filter((_, idx) => idx !== i))}
              aria-label={`删除任务 ${i + 1}`}
              className="ml-auto cursor-pointer rounded-sm p-1.5 text-cv-muted-fg transition-colors duration-200 hover:bg-cv-danger/10 hover:text-cv-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30"
            >
              <Trash2 size={14} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>

          <FieldLabel htmlFor={`task-name-${i}`} hint="一句话说清这件事在做什么">
            任务小标题
          </FieldLabel>
          <input
            id={`task-name-${i}`}
            aria-label={`任务 ${i + 1} 小标题`}
            className={cn(inputVariants({ size: 'md' }), 'w-full')}
            placeholder="如：增长模块需求迭代"
            value={task.name}
            onChange={(e) => patch(i, 'name', e.target.value)}
          />

          <div className="mt-3.5 space-y-3">
            {STAR_ROWS.map((row) => (
              <div key={row.key}>
                <label
                  htmlFor={`task-${i}-${row.key}`}
                  className="mb-1.5 flex items-center gap-2 font-display text-[12.5px] font-extrabold text-cv-fg"
                >
                  <StarOrb letter={row.letter} orb={row.orb} />
                  {row.label}
                  <span className="font-sans font-normal text-cv-muted-fg">
                    {row.key === 'star_s' && '这件事当时的背景 / 要解决的问题'}
                    {row.key === 'star_t' && '这件事要达成的具体目标'}
                    {row.key === 'star_a' && '你具体做了什么'}
                    {row.key === 'star_r' && '产生的结果，最好有数字'}
                  </span>
                </label>
                <textarea
                  id={`task-${i}-${row.key}`}
                  aria-label={`任务 ${i + 1} ${row.label}`}
                  rows={2}
                  className={cn(inputVariants({ size: 'md' }), 'w-full py-3 leading-relaxed')}
                  placeholder="留空也可以，原文没提到就不用硬凑"
                  value={task[row.key]}
                  onChange={(e) => patch(i, row.key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...tasks, { name: '', star_s: '', star_t: '', star_a: '', star_r: '' }])}
      >
        <Plus size={16} strokeWidth={2.8} aria-hidden="true" />
        添加任务
      </Button>
    </div>
  );
}
