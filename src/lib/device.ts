/**
 * 设备标识 —— 线上多用户数据隔离的唯一依据。
 *
 * 为什么需要它：这个应用发布到公网之后，同一个后端会被很多人打开。
 * 「经历库」本来的语义是"一个人的完整工作区"，但如果所有人共用同一个
 * 数据库，访客 A 一打开就能看到访客 B 的经历和简历 —— 这不可接受。
 *
 * 方案：每个浏览器在首次访问时生成一个随机设备标识，存在 localStorage，
 * 之后所有 API 请求都带上 `X-CV-Owner`。后端按这个标识把数据落到
 * 各自独立的 SQLite 文件里（api/db.py::db_path），彼此完全隔离。
 * 不需要注册、不需要登录 —— 打开即用，数据天然各归各。
 *
 * 为什么只在发布域名下启用（isOnAppDomain）：
 *   本机开发时（localhost / 127.0.0.1）仍然走 `data/careervault.db`
 *   这个默认库 —— 已有的本地数据、迁移脚本、命令行工具都不受影响。
 *   一旦启用标识，本机也会被切到一个空的独立库里，老数据反而"看不见"了。
 */
import { isOnAppDomain } from './cloud';

const KEY = 'cv_device_id';

function loadDeviceId(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
  } catch {
    /* 隐私模式写不了：本次会话用临时标识，刷新后是"新设备" */
  }
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  // 与后端的白名单一致（api/db.py::sanitize_owner）：只留安全字符
  const id = raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, 48);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* 写不进就算了，本次会话内仍然有效 */
  }
  return id;
}

export const DEVICE_ID = loadDeviceId();

/** 是否需要在请求里携带设备标识（只有线上发布域名下才隔离） */
export const SEND_OWNER_HEADER = isOnAppDomain() && DEVICE_ID.length >= 8;

/*
 * 统一注入设备标识。
 * 全站有 20+ 处 fetch 调用（App / views / lib），逐处传 header 既啰嗦
 * 又一定会有漏网之鱼——漏掉的那一处在线上就是"看到别人的数据"。
 * 所以在这里包一层 window.fetch，一处生效、全站覆盖。
 * 导出文件下载（PDF / Word / 备份）不走 fetch，改用 lib/download.ts。
 */
if (SEND_OWNER_HEADER) {
  const rawFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const base = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    const headers = new Headers(base);
    headers.set('X-CV-Owner', DEVICE_ID);
    return rawFetch(input, { ...init, headers });
  };
}
