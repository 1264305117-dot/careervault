import {
  ArrowUpDown,
  BookOpenText,
  ChevronDown,
  ChevronUp,
  FileUp,
  Layers,
  ListChecks,
  Plus,
  Search,
  SearchX,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  ClayPanel,
  EmptyState,
  Input,
  Orb,
  PageHeader,
  Reveal,
  Select,
  SectionTitle,
  TagList,
  TaskAccordion,
  TypeBadge,
  TYPE_META,
  VaultSwitcher,
  type VaultSwitcherProps,
} from '@/components/cv';
import type { Experience, ExpType } from '@/types/experience';
import { EXP_TYPES } from '@/types/experience';
import type { ToastFn } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { infoBullets, isInfoType } from '@/lib/infolines';

/**
 * 经历总览 —— 全站样板页。
 *
 * 页面节奏（从上到下）：
 *   1. 页头    渐变图标球 + 眉标 + Nunito 大标题 + 主次分明的两个动作
 *   2. 渐变黏土统计带   一排圆形统计球，把"概览数字"和"分类筛选"合并成同一个控件
 *   3. 工具栏  检索 / 排序 / 标签，全部收进一张玻璃黏土卡
 *   4. 结果列表  信息密度优先：类型球 → 标题 → 时间 → 结果(R) → 标签
 *
 * 相对旧版的关键改动：删掉了"统计卡筛选"与"类型药丸筛选"两套重复入口，
 * 合并为彩色面板上的一排球 —— 既去掉重复，也拿到设计系统要求的"高潮位"色块。
 */

type SortKey = 'recent' | 'date' | 'title';

const ORB_TONES = ['violet', 'pink', 'sky', 'amber', 'emerald'] as const;

/** 从"2025年7月–2025年10月"这类文本里取起始年月，用于按经历时间排序 */
function startKeyOf(dateRange: string): number {
  const m = dateRange.match(/(\d{4})\D*(\d{1,2})?/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 100 + (m[2] ? parseInt(m[2], 10) : 0);
}

export default function DashboardView({
  experiences,
  vault,
  toast,
  onAdd,
  onImport,
  onEdit,
  onDelete,
}: {
  experiences: Experience[];
  vault: VaultSwitcherProps;
  toast: ToastFn;
  onAdd: () => void;
  onImport: () => void;
  onEdit: (e: Experience) => void;
  onDelete: (id: number) => void;
}) {
  const currentVaultName = vault.vaults.find((v) => v.id === vault.currentId)?.name ?? '';
  const [filter, setFilter] = useState<'all' | ExpType>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const stats = useMemo(() => {
    const counts = {} as Record<ExpType, number>;
    EXP_TYPES.forEach((t) => (counts[t] = 0));
    experiences.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
    return counts;
  }, [experiences]);

  const coveredTypes = useMemo(
    () => EXP_TYPES.filter((t) => stats[t] > 0).length,
    [stats],
  );

  const filtered = useMemo(() => {
    let list = filter === 'all' ? experiences : experiences.filter((e) => e.type === filter);
    if (tagFilter) list = list.filter((e) => e.tags.includes(tagFilter));
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        // 任务级的内容也要能搜到：搜"用户访谈"不该因为它在某个任务里就漏掉
        [
          e.title,
          e.org,
          e.date_range,
          e.star_s,
          e.star_t,
          e.star_a,
          e.star_r,
          ...(e.tasks ?? []).flatMap((t) => [t.name, t.star_s, t.star_t, t.star_a, t.star_r]),
          ...e.tags,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    if (sortBy === 'date') {
      list = [...list].sort((a, b) => startKeyOf(b.date_range) - startKeyOf(a.date_range));
    } else if (sortBy === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    }
    return list;
  }, [experiences, filter, tagFilter, query, sortBy]);

  // 标签云：按出现次数排序，只展示出现过的标签
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    experiences.forEach((e) => e.tags.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'));
  }, [experiences]);

  const hasActiveQuery = query.trim() !== '' || tagFilter !== null || filter !== 'all';

  function clearAllFilters() {
    setQuery('');
    setTagFilter(null);
    setFilter('all');
  }

  function toggleExpand(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTag(tag: string) {
    setTagFilter((cur) => (cur === tag ? null : tag));
    toast('ok', tagFilter === tag ? '已取消标签筛选' : `已按「${tag}」筛选`);
  }

  return (
    <>
      <Reveal>
        <PageHeader
          label="Experience Vault"
          icon={BookOpenText}
          title="我的经历"
          accent="全部资产"
          description="所有经历一处沉淀，投简历时随取随用。按类型、标签或关键词都能秒查到。"
          actions={
            <>
              <Button variant="secondary" onClick={onImport}>
                <FileUp size={16} strokeWidth={2.6} aria-hidden="true" />
                导入简历
              </Button>
              <Button onClick={onAdd}>
                <Plus size={17} strokeWidth={2.8} aria-hidden="true" />
                记录新经历
              </Button>
            </>
          }
        />
      </Reveal>

      {/* ---------- 经历库切换：先确定"看谁的数据"，再看数据 ---------- */}
      <Reveal delay={60} className="mt-7">
        <VaultSwitcher {...vault} />
      </Reveal>

      {/* ---------- 渐变黏土统计带：概览 + 筛选合二为一 ---------- */}
      <Reveal delay={120} className="mt-5">
        <ClayPanel className="p-7 sm:p-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="font-display text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/70">
                Vault Overview · {currentVaultName || '经历库'}
              </p>
              <p className="mt-2.5 font-display text-[2rem] font-black leading-tight tracking-tight text-white">
                {experiences.length} 段经历 · 覆盖 {coveredTypes} 类
              </p>
              <p className="mt-2 text-sm font-medium text-white/80">
                {hasActiveQuery ? '点球切换分类，或清空筛选看全部' : '点一下任意一颗球即可筛选下方列表'}
              </p>
            </div>
            {hasActiveQuery && (
              <Button variant="inverted" size="sm" onClick={clearAllFilters}>
                <X size={14} strokeWidth={2.8} aria-hidden="true" />
                清空筛选
              </Button>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4 sm:gap-5">
            <Orb
              value={experiences.length}
              label="全部"
              icon={Layers}
              active={filter === 'all'}
              onPanel
              onClick={() => setFilter('all')}
            />
            {EXP_TYPES.map((t, i) => {
              const active = filter === t;
              const meta = TYPE_META[t];
              return (
                <Orb
                  key={t}
                  value={stats[t] || 0}
                  label={meta.zh}
                  icon={meta.icon}
                  tone={ORB_TONES[i % ORB_TONES.length]}
                  active={active}
                  onPanel
                  onClick={() => setFilter(active ? 'all' : t)}
                  title={active ? '取消筛选，看全部经历' : `只看${meta.zh}经历`}
                />
              );
            })}
          </div>
        </ClayPanel>
      </Reveal>

      {/* ---------- 工具栏 ---------- */}
      <Reveal delay={180} className="mt-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search
                size={16}
                strokeWidth={2.6}
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cv-accent"
              />
              <Input
                aria-label="搜索经历"
                className="pl-11 pr-10"
                placeholder="搜索标题、组织、标签或经历内容，如：SQL / 用户研究"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="清空搜索"
                  className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-cv-muted-fg transition-colors duration-200 hover:bg-white/70 hover:text-cv-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
                >
                  <X size={15} strokeWidth={2.8} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm bg-white/70 text-cv-accent shadow-claySoft">
                <ArrowUpDown size={16} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <Select
                aria-label="排序方式"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
              >
                <option value="recent">最近录入</option>
                <option value="date">经历时间（新→旧）</option>
                <option value="title">标题（拼音/笔画）</option>
              </Select>
            </div>

            <span className="rounded-full bg-white/70 px-4 py-2 font-display text-[12px] font-extrabold text-cv-muted-fg shadow-claySoft">
              命中 <b className="text-cv-accent">{filtered.length}</b> / {experiences.length}
            </span>
          </div>

          {tagCloud.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-cv-border pt-4">
              <SectionTitle className="mr-1">标签</SectionTitle>
              {tagCloud.slice(0, 24).map(([tag, count]) => (
                <Chip
                  key={tag}
                  active={tagFilter === tag}
                  count={count}
                  onClick={() => toggleTag(tag)}
                  title={`按标签筛选：${tag}（${count} 条）`}
                >
                  {tag}
                </Chip>
              ))}
              {tagCloud.length > 24 && (
                <span className="text-[11px] font-medium text-cv-muted-fg">
                  等 {tagCloud.length} 个标签
                </span>
              )}
            </div>
          )}
        </Card>
      </Reveal>

      {/* ---------- 结果列表 ---------- */}
      <Reveal delay={240} className="mt-5">
        {filtered.length === 0 ? (
          hasActiveQuery ? (
            <EmptyState
              icon={SearchX}
              tone="sky"
              title="没有匹配的经历"
              description="换一个关键词，或者把筛选条件清空再看看。"
              actions={
                <Button variant="secondary" onClick={clearAllFilters}>
                  清空筛选条件
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={BookOpenText}
              title="经历库还是空的"
              description="先手动记录一段，或者把现有简历导进来——AI 会把每条要点拆成独立任务，各自识别 S/T/A/R，确认后批量入库。"
              actions={
                <>
                  <Button onClick={onAdd}>
                    <Plus size={17} strokeWidth={2.8} aria-hidden="true" />
                    记录第一段经历
                  </Button>
                  <Button variant="secondary" onClick={onImport}>
                    <FileUp size={16} strokeWidth={2.6} aria-hidden="true" />
                    导入已有简历
                  </Button>
                </>
              }
            />
          )
        ) : (
          <div className="space-y-4">
            {filtered.map((e) => {
              const expanded = expandedIds.has(e.id);
              const tasks = e.tasks ?? [];
              // 教育 / 技能是条目式罗列：原文原样分条展示，不做"任务"、也不做亮点提炼
              const isInfo = isInfoType(e.type);
              const infoItems = isInfo ? infoBullets(e) : [];
              // 卡片摘要只取「整体在做什么」，不再把 R（结果）拎出来做亮点块；
              // 结果属于 STAR 的一部分，展开「主线 STAR」就能看到
              const summary = e.star_a || e.star_t || e.star_s;
              // 主线 STAR 可展开才给箭头（教育/技能的内容已在上面分条列出，不给一个点了没反应的按钮）
              const hasMainStar = !isInfo && Boolean(e.star_s || e.star_t || e.star_a || e.star_r);
              const meta = TYPE_META[e.type];
              const Icon = meta.icon;
              return (
                <Card key={e.id} interactive className="p-6">
                  <div className="flex items-start gap-4">
                    {/* 类型渐变球：卡片左侧的"身份标记"，扫视时最先被看到 */}
                    <span
                      className={cn(
                        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white',
                        'shadow-[5px_5px_12px_rgb(124_58_237_/_0.24),-3px_-3px_9px_rgb(255_255_255_/_0.7),inset_3px_3px_6px_rgb(255_255_255_/_0.32)]',
                        meta.orb,
                      )}
                      aria-hidden="true"
                    >
                      <Icon size={19} strokeWidth={2.6} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <h3 className="font-display text-[17px] font-extrabold tracking-tight text-cv-fg">
                          {e.title}
                        </h3>
                        <TypeBadge type={e.type} />
                        {tasks.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-cv-accent/[0.1] px-3 py-1 font-display text-[11px] font-extrabold text-cv-accent shadow-claySoft"
                            title={`这段经历拆成了 ${tasks.length} 项独立任务`}
                          >
                            <ListChecks size={12} strokeWidth={2.8} aria-hidden="true" />
                            {tasks.length} 项任务
                          </span>
                        )}
                        <span className="ml-auto rounded-full bg-white/60 px-3 py-1 font-display text-[11px] font-bold text-cv-muted-fg shadow-claySoft">
                          {e.date_range}
                        </span>

                        {/* 卡片操作：默认低调，hover / 键盘聚焦 / 窄屏时完全显现 */}
                        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
                          {hasMainStar && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => toggleExpand(e.id)}
                              aria-expanded={expanded}
                              aria-label={`${expanded ? '收起' : '展开'}主线 STAR：${e.title}`}
                            >
                              {expanded ? (
                                <ChevronUp size={16} strokeWidth={2.8} aria-hidden="true" />
                              ) : (
                                <ChevronDown size={16} strokeWidth={2.8} aria-hidden="true" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEdit(e)}
                            aria-label={`编辑经历：${e.title}`}
                          >
                            <SquarePen size={15} strokeWidth={2.6} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onDelete(e.id)}
                            aria-label={`删除经历：${e.title}`}
                            className="hover:bg-cv-danger/10 hover:text-cv-danger"
                          >
                            <Trash2 size={15} strokeWidth={2.6} aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      {e.org && (
                        <p className="mt-2 text-sm font-medium text-cv-muted-fg">{e.org}</p>
                      )}

                      {/* 教育 / 技能：原简历里怎么分条，这里就怎么分条 */}
                      {isInfo ? (
                        infoItems.length > 0 && (
                          <ul className="mt-3.5 space-y-1.5">
                            {infoItems.map((line, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2.5 text-sm font-medium leading-relaxed text-cv-fg/90"
                              >
                                <span
                                  className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-cv-accent/70"
                                  aria-hidden="true"
                                />
                                <span>{line}</span>
                              </li>
                            ))}
                          </ul>
                        )
                      ) : summary ? (
                        <p className="mt-3 line-clamp-2 text-sm font-medium leading-relaxed text-cv-muted-fg">
                          {summary}
                        </p>
                      ) : null}

                      {/* 任务清单常显：这段经历做了几件事、每件事叫什么，一眼看全；
                          具体 STAR 收在每项任务里，点标题才展开 */}
                      <TaskAccordion tasks={tasks} className="mt-5" />

                      {expanded && (e.star_s || e.star_t || e.star_a || e.star_r) && (
                        <dl className="mt-4 grid grid-cols-1 gap-4 rounded-md bg-cv-surface/80 p-5 shadow-clayPressedSm sm:grid-cols-3">
                          <div className="sm:col-span-full">
                            <p className="font-display text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-cv-muted-fg">
                              主线 STAR · 整段经历的概括
                            </p>
                          </div>
                          {(
                            [
                              ['S · 情境', e.star_s],
                              ['T · 任务', e.star_t],
                              ['A · 行动', e.star_a],
                              ['R · 结果', e.star_r],
                            ] as const
                          )
                            .filter(([, v]) => v)
                            .map(([label, v]) => (
                              <div key={label} className={label === 'R · 结果' ? 'sm:col-span-full' : undefined}>
                                <dt className="font-display text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-cv-accent">
                                  {label}
                                </dt>
                                <dd className="mt-1.5 text-sm font-medium leading-relaxed text-cv-fg/85">
                                  {v}
                                </dd>
                              </div>
                            ))}
                        </dl>
                      )}

                      <TagList tags={e.tags} className="mt-4" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Reveal>
    </>
  );
}
