/**
 * 带鉴权上下文的文件下载。
 *
 * 线上多设备隔离后，`<a href="/api/...">` 这种直接跳转的下载拿不到
 * `X-CV-Owner` 请求头，后端会按"另一个设备"处理 —— 要么 404，要么
 * 更糟：把别人的文件给下来。所以下载一律走 fetch（device.ts 的补丁
 * 会自动带上设备标识），拿到 blob 再触发保存。
 */
export async function downloadFile(url: string, fallbackName: string): Promise<{ ok: boolean; status?: number }> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false };
  }
  if (!res.ok) return { ok: false, status: res.status };

  // 后端用 filename*=UTF-8'' 传中文名；解析不到就退回调用方给的名字
  const dispo = res.headers.get('content-disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/i.exec(dispo) || /filename="?([^";]+)"?/i.exec(dispo);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 立刻回收会在个别浏览器里打断下载，留一拍再释放
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
  return { ok: true };
}
