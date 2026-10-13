import { useCallback, useEffect, useRef, useState } from "react";
import {
  Database,
  DownloadCloud,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import type { BackupImportResult, BackupStats, VaultTrashItem } from "@/types/experience";
import { BTN_ACCENT, type ToastFn } from "@/lib/ui";
import { downloadFile } from "@/lib/download";
import { clearVaultTrash, listVaultTrash, purgeVaultTrash, restoreVaultTrash } from "@/lib/vaults";
import { Button, Card, PageHeader, SectionTitle } from "@/components/cv";

function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * 下载备份。不走 `<a href>` 直接跳转：线上多设备隔离时跳转请求带不上
 * 设备标识，后端会拒绝 —— 统一走 fetch + blob（lib/download.ts）。
 */
async function downloadBackup(toast: ToastFn) {
  // 时间戳逐段拼，不用正则清洗 ISO 串 —— 源码里出现方括号包起来的
  // 字符类时，Tailwind 会把它当成类名扫描，生成一段非法 CSS 让构建告警
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  const r = await downloadFile("/api/backup/export", `careervault-backup-${stamp}.json`);
  if (r.ok) toast("ok", "备份文件已开始下载");
  else toast("err", "导出失败，请稍后重试");
}

/**
 * 数据备份：单机 SQLite 场景下，让用户自己就能把数据带走 / 恢复。
 * 导出 = 下载一份 JSON；恢复 = 合并导入（重复项跳过，不会覆盖当前数据）。
 */
export default function DataView({
  toast,
  onDataChanged,
}: {
  toast: ToastFn;
  onDataChanged: () => void;
}) {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 回收站：被删掉的经历库躺在这里，恢复是一键的，彻底删除才真的抹掉
  const [trash, setTrash] = useState<VaultTrashItem[]>([]);
  const [trashBusy, setTrashBusy] = useState<number | "clear" | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch {
      toast("err", "读取数据统计失败：后端没连上");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTrash = useCallback(async () => {
    try {
      setTrash(await listVaultTrash());
    } catch {
      /* 静默：连不上后端时上面的统计卡已经给了提示 */
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadTrash();
  }, [loadStats, loadTrash]);

  /** 从回收站恢复一个经历库 */
  async function restoreFromTrash(item: VaultTrashItem) {
    setTrashBusy(item.id);
    try {
      const back = await restoreVaultTrash(item.id);
      await loadTrash();
      await loadStats();
      onDataChanged();
      toast(
        "ok",
        `已恢复「${back.name}」（${back.experiences} 段经历 · ${back.resumes} 份简历）\n` +
          "可以在「经历总览」页切换到它",
      );
    } catch (e) {
      toast("err", `恢复失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setTrashBusy(null);
    }
  }

  /** 彻底删除：这一步之后数据真的从磁盘上消失，所以要问一句 */
  async function purgeOne(item: VaultTrashItem) {
    if (
      !confirm(
        `彻底删除「${item.vault_name}」？\n其中的 ${item.experiences} 段经历、${item.resumes} 份简历将被永久抹掉，之后无法恢复。`,
      )
    )
      return;
    setTrashBusy(item.id);
    try {
      await purgeVaultTrash(item.id);
      await loadTrash();
      await loadStats();
      toast("ok", `已彻底删除「${item.vault_name}」`);
    } catch (e) {
      toast("err", `彻底删除失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setTrashBusy(null);
    }
  }

  async function clearAllTrash() {
    if (!trash.length) return;
    if (!confirm(`清空回收站？其中 ${trash.length} 个已删除的经历库将被永久抹掉，无法恢复。`)) return;
    setTrashBusy("clear");
    try {
      const n = await clearVaultTrash();
      await loadTrash();
      await loadStats();
      toast("ok", `回收站已清空（${n} 个）`);
    } catch (e) {
      toast("err", `清空失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setTrashBusy(null);
    }
  }

  async function importBackup(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        toast("err", "这个文件不是合法的 JSON，请选择由「导出数据备份」生成的 .json 文件");
        return;
      }
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }
      const r = data as BackupImportResult;
      toast(
        "ok",
        `恢复完成：新增 ${r.imported_experiences} 条经历、${r.imported_resumes} 份简历` +
          (r.skipped_experiences + r.skipped_resumes > 0
            ? `；跳过重复项 ${r.skipped_experiences + r.skipped_resumes} 条`
            : "") +
          `\n当前共 ${r.total_experiences} 条经历、${r.total_resumes} 份简历`,
      );
      await loadStats();
      onDataChanged();
    } catch (e) {
      toast("err", `恢复失败：${e instanceof Error ? e.message : "后端没连上"}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const tiles = [
    { label: "经历库", value: stats ? `${stats.vaults} 个` : "—", tone: "text-cv-accent" },
    { label: "经历", value: stats ? `${stats.experiences} 条` : "—", tone: "text-cv-accent" },
    { label: "简历", value: stats ? `${stats.resumes} 份` : "—", tone: "text-cv-pink" },
    { label: "数据库文件", value: stats ? formatSize(stats.db_size) : "—", tone: "text-cv-sky" },
    {
      label: "最近更新",
      value:
        stats && (stats.latest_experience_at || stats.latest_resume_at)
          ? (stats.latest_experience_at > stats.latest_resume_at
              ? stats.latest_experience_at
              : stats.latest_resume_at
            ).replace("T", " ")
          : "—",
      tone: "text-cv-fg",
    },
  ];

  return (
    <section>
      <PageHeader
        label="Data Backup"
        icon={Database}
        iconTone="sky"
        title="数据"
        accent="备份"
        description="数据存在本机 SQLite 文件里；定期导出一份，换电脑或误删时都能找回来"
      />

      <Card className="mt-8 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>当前数据</SectionTitle>
          <button
            onClick={loadStats}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-4 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30 disabled:opacity-60"
          >
            <RefreshCw size={12} strokeWidth={3} aria-hidden="true" /> {loading ? "刷新中…" : "刷新"}
          </button>
        </div>

        {/* 数据格：凹陷的槽，数字用高饱和色凸出来 */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((s) => (
            <div
              key={s.label}
              className="rounded-md bg-cv-surface/85 px-4 py-3.5 shadow-clayPressedSm"
            >
              <div className="font-display text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-cv-muted-fg">
                {s.label}
              </div>
              <div
                className={`mt-1.5 break-all font-display text-[15px] font-black leading-tight ${s.tone}`}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
        {stats && (
          <div className="mt-4 break-all font-display text-[11px] font-bold text-cv-muted-fg">
            数据库位置：{stats.db_path}
          </div>
        )}
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col p-6">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <DownloadCloud size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
              导出数据备份
            </span>
          </SectionTitle>
          <p className="mt-3 flex-1 text-xs font-medium leading-relaxed text-cv-muted-fg">
            把全部经历库（含经历与简历）打包成一个 JSON 文件下载到本地。建议每次大批量导入简历后导出一份。
          </p>
          <button
            type="button"
            onClick={() => void downloadBackup(toast)}
            className={`${BTN_ACCENT} mt-5 cursor-pointer self-start`}
          >
            <DownloadCloud size={15} aria-hidden="true" /> 下载备份文件（.json）
          </button>
        </Card>

        <Card className="p-6">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <UploadCloud size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-accent" />
              从备份恢复
            </span>
          </SectionTitle>
          <p className="mt-3 text-xs font-medium leading-relaxed text-cv-muted-fg">
            选择之前导出的 .json 文件。
            <b className="text-cv-fg">合并模式</b>：同名经历库（如「我的经历库」）会并入现有库，
            库内重复的经历（同类型 + 同标题 + 同组织）和简历会被自动跳过，
            不会覆盖或删除你现有的数据。旧版本（1.0 / 1.1）的备份也能导入，内容会落到默认经历库。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              aria-label="选择备份文件"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackup(f);
              }}
              className="text-sm font-medium text-cv-muted-fg file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-white/80 file:px-5 file:py-2.5 file:font-display file:text-[13px] file:font-extrabold file:text-cv-accent file:shadow-claySoft hover:file:-translate-y-0.5 file:transition-all file:duration-200"
            />
            {importing && (
              <span className="font-display text-[11.5px] font-extrabold text-cv-accent">恢复中…</span>
            )}
          </div>
        </Card>
      </div>

      {/* ---------- 回收站：经历库被一键删除后先落到这里 ---------- */}
      <Card className="mt-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>
            <span className="inline-flex items-center gap-2">
              <Trash2 size={16} strokeWidth={2.6} aria-hidden="true" className="text-cv-danger" />
              回收站
              {trash.length > 0 && (
                <span className="rounded-full bg-cv-danger/12 px-2.5 py-0.5 font-display text-[11px] font-extrabold text-cv-danger">
                  {trash.length}
                </span>
              )}
            </span>
          </SectionTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadTrash();
                loadStats();
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/70 px-4 py-1.5 font-display text-[11.5px] font-extrabold text-cv-accent shadow-claySoft transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30"
            >
              <RefreshCw size={12} strokeWidth={3} aria-hidden="true" /> 刷新
            </button>
            {trash.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => void clearAllTrash()}
                loading={trashBusy === "clear"}
              >
                <Trash2 size={14} strokeWidth={2.8} aria-hidden="true" /> 清空回收站
              </Button>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs font-medium leading-relaxed text-cv-muted-fg">
          在「经历总览」页删除的经历库会先落到这里（整库快照，含其中的经历与简历）。
          恢复 = 原样插回，甚至连条目 id 都不变；只有点「彻底删除」或「清空回收站」才会真正从磁盘上抹掉。
        </p>

        {trash.length === 0 ? (
          <div className="mt-4 rounded-md border-2 border-dashed border-cv-border/80 px-5 py-6 text-center font-display text-[12px] font-bold text-cv-muted-fg">
            回收站是空的
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {trash.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded-md bg-cv-surface/85 px-4 py-3.5 shadow-clayPressedSm"
              >
                <span
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-white/80 text-cv-muted-fg shadow-claySoft"
                  aria-hidden="true"
                >
                  <Trash2 size={15} strokeWidth={2.6} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="truncate font-display text-[13.5px] font-extrabold text-cv-fg">
                      {item.vault_name}
                    </b>
                    {item.owner && (
                      <span className="rounded-full bg-cv-accent/10 px-2.5 py-0.5 font-display text-[10.5px] font-extrabold text-cv-accent">
                        {item.owner}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block font-display text-[11.5px] font-bold text-cv-muted-fg">
                    {item.experiences} 段经历 · {item.resumes} 份简历 · 删除于{" "}
                    {(item.deleted_at || "").replace("T", " ")}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void restoreFromTrash(item)}
                    loading={trashBusy === item.id}
                    aria-label={`恢复经历库：${item.vault_name}`}
                  >
                    <RotateCcw size={14} strokeWidth={2.8} aria-hidden="true" /> 恢复
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void purgeOne(item)}
                    disabled={trashBusy !== null}
                    aria-label={`彻底删除经历库：${item.vault_name}`}
                  >
                    {trashBusy === item.id ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 size={14} strokeWidth={2.8} aria-hidden="true" />
                    )}
                    彻底删除
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {trash.length > 0 && (
          <p className="mt-3.5 font-display text-[11px] font-bold text-cv-muted-fg">
            回收站只保留最近 20 个被删除的经历库（更早的会自动丢弃），清空后不可再恢复。
          </p>
        )}
      </Card>

      <div className="mt-4 flex items-start gap-3 rounded-md border border-white/70 bg-white/70 px-5 py-4 shadow-claySoft">
        <ShieldCheck size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-cv-ok" aria-hidden="true" />
        <span className="text-xs font-medium leading-relaxed text-cv-muted-fg">
          数据全部保存在你自己电脑的{' '}
          <code className="rounded-sm bg-cv-surface px-2 py-0.5 font-display text-[11px] font-extrabold text-cv-accent shadow-clayPressedSm">
            data/careervault.db
          </code>{' '}
          里，不上传任何服务器；备份文件也只包含经历与简历内容。想彻底备份，直接复制该文件即可。
        </span>
      </div>

      <div className="mt-3 flex items-start gap-3 rounded-md bg-cv-warn/10 px-5 py-4 text-xs font-medium text-cv-warn shadow-claySoft">
        <TriangleAlert size={16} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          删除经历库是一键生效的，但整库会先移入上面的回收站——十秒内可撤销，
          事后也能在这里一键找回。真正不可逆的只有「彻底删除」和「清空回收站」，
          做批量改动前建议先导出一份备份。
        </span>
      </div>
    </section>
  );
}
