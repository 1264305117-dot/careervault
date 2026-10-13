/**
 * 经历库（Vault）客户端工具。
 *
 * 当前正在看哪个库是一个**全局上下文**：经历列表、简历列表、岗位匹配、面试准备
 * 全都跟着它走。所以这里既提供请求 URL 的拼装，也负责把选择记在 localStorage，
 * 刷新页面后不会跳回默认库。
 */
import type { Vault, VaultDeleteResult, VaultTrashItem } from '@/types/experience';

const CURRENT_VAULT_KEY = 'cv_current_vault';

export function loadVaultId(): number | null {
  try {
    const raw = localStorage.getItem(CURRENT_VAULT_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveVaultId(id: number): void {
  try {
    localStorage.setItem(CURRENT_VAULT_KEY, String(id));
  } catch {
    /* 隐私模式下写不了，忽略即可：本次会话内仍然正常 */
  }
}

/**
 * 从库里挑出「当前应该展示的库」：
 * 优先用记在 localStorage 的那个（且它还存在），否则用第一个库。
 * 用户删掉当前库后旧 id 会失效，这里自动兜住，不会出现空白页。
 */
export function pickVault(vaults: Vault[]): Vault | null {
  if (!vaults.length) return null;
  const saved = loadVaultId();
  return vaults.find((v) => v.id === saved) ?? vaults[0];
}

/** 给 API 地址带上 vault_id（已有 query 时用 & 拼接） */
export function withVault(url: string, vaultId: number | null): string {
  if (!vaultId) return url;
  return `${url}${url.includes('?') ? '&' : '?'}vault_id=${vaultId}`;
}

/* ---------------- 删除 / 撤销 / 回收站 ----------------
 * 删除经历库是**整库级**的重操作，所以前后端一起做了三层保护：
 *   1. 一键删除（不弹确认框）——后端把整库快照写进本机回收站
 *   2. 底部撤销条 10 秒内一键还原（走 trash_id，内容与 id 原样回来）
 *   3. 「数据备份」页的回收站列表，事后任何时间都能找回
 * 任何一步失败都只抛错，不静默——删库这种事不能"猜它成功了"。
 */

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return (data as { detail?: string } | null)?.detail || fallback;
}

export async function deleteVault(id: number): Promise<VaultDeleteResult> {
  const res = await fetch(`/api/vaults/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, `HTTP ${res.status}`));
  return res.json();
}

export async function restoreVaultTrash(trashId: number): Promise<Vault> {
  const res = await fetch(`/api/vaults/trash/${trashId}/restore`, { method: 'POST' });
  if (!res.ok) throw new Error(await readError(res, `HTTP ${res.status}`));
  return res.json();
}

export async function listVaultTrash(): Promise<VaultTrashItem[]> {
  const res = await fetch('/api/vaults/trash');
  if (!res.ok) throw new Error(await readError(res, `HTTP ${res.status}`));
  return res.json();
}

/** 彻底删除一条：这一步之后数据真的从磁盘上没了 */
export async function purgeVaultTrash(trashId: number): Promise<void> {
  const res = await fetch(`/api/vaults/trash/${trashId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, `HTTP ${res.status}`));
}

/** 清空回收站 */
export async function clearVaultTrash(): Promise<number> {
  const res = await fetch('/api/vaults/trash', { method: 'DELETE' });
  if (!res.ok) throw new Error(await readError(res, `HTTP ${res.status}`));
  const data = (await res.json().catch(() => null)) as { purged?: number } | null;
  return data?.purged ?? 0;
}
