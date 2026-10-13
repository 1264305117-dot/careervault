import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 证件照。
 *
 * 照片以 data URL 存进简历内容里（不走文件服务器，和"数据只在本机"的承诺一致），
 * 所以上传前**必须在浏览器里压一遍**：一张手机拍的 3MB 照片直接存库，
 * 数据库会迅速膨胀，导出 PDF 也会变慢。这里统一压到长边 320px 的 JPEG
 * （320px 打印在 A4 上约 27mm 宽，200dpi 左右，足够清晰）。
 *
 * 统一输出 JPEG 还有一个后端原因：reportlab 读 JPEG 不需要 Pillow，
 * PNG（尤其带透明通道）在部分环境里会直接报错。
 */

const MAX_EDGE = 320;
const JPEG_QUALITY = 0.88;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export async function resizeImageFile(
  file: File,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件（JPG / PNG / WebP）');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('图片超过 8MB，请先压缩或换一张');
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败，换一张试试'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('这张图片无法解析，换一张试试'));
    im.src = dataUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器不支持图片处理');
  // JPEG 没有透明通道：先铺白底，否则 PNG 的透明区域会变成黑色
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export interface PhotoFieldProps {
  value: string;
  onChange: (dataUrl: string) => void;
  onError?: (message: string) => void;
  /** 深色 / 彩色底上使用（色带模板的页头） */
  onDark?: boolean;
  /** 成品预览态：只展示照片本身，隐藏"换 / 移除"等编辑控件 */
  hideControls?: boolean;
  className?: string;
}

export function PhotoField({
  value,
  onChange,
  onError,
  onDark = false,
  hideControls = false,
  className,
}: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await resizeImageFile(file));
    } catch (e) {
      onError?.(e instanceof Error ? e.message : '照片处理失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      aria-label="上传证件照"
      className="hidden"
      onChange={(e) => void handleFile(e.target.files?.[0])}
    />
  );

  if (hideControls) {
    // 预览态：没照片就整个不渲染，有照片只露照片本身
    return value ? (
      <div className={cn('w-24 shrink-0', className)}>
        <img
          src={value}
          alt="简历证件照"
          className={cn(
            'block h-auto w-full rounded-clay border object-cover',
            onDark ? 'border-white/40' : 'border-white/70',
            'shadow-claySoft',
          )}
        />
      </div>
    ) : null;
  }

  if (!value) {
    return (
      <div className={className}>
        {input}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(
            'flex w-24 cursor-pointer flex-col items-center gap-1.5 rounded-clay border-2 border-dashed px-2.5 py-4 text-center transition-all duration-200',
            onDark
              ? 'border-white/40 text-white/85 hover:border-white/80 hover:bg-white/10'
              : 'border-cv-accent/25 text-cv-muted-fg hover:-translate-y-0.5 hover:border-cv-accent/60 hover:text-cv-accent',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
          )}
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus size={18} strokeWidth={2.6} aria-hidden="true" />
          )}
          <span className="font-display text-[11px] font-extrabold leading-snug">
            {busy ? '处理中' : '加证件照'}
          </span>
          <span className={cn('text-[10px] font-medium leading-tight', onDark ? 'text-white/60' : 'text-cv-muted-fg/80')}>
            自动压到 320px
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn('w-24 shrink-0', className)}>
      {input}
      <div className="relative">
        <img
          src={value}
          alt="简历证件照"
          className={cn(
            'block h-auto w-full rounded-clay border object-cover',
            onDark ? 'border-white/40' : 'border-white/70',
            'shadow-claySoft',
          )}
        />
        <div className="mt-1.5 flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            title="换一张"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-display text-[10.5px] font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-accent/30',
              onDark
                ? 'bg-white/20 text-white hover:bg-white/35'
                : 'bg-white/75 text-cv-accent shadow-claySoft hover:-translate-y-0.5',
            )}
          >
            {busy ? (
              <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={11} strokeWidth={3} aria-hidden="true" />
            )}
            换
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            title="移除照片"
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-display text-[10.5px] font-extrabold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cv-danger/30',
              onDark
                ? 'bg-white/20 text-white hover:bg-cv-danger'
                : 'bg-white/75 text-cv-danger shadow-claySoft hover:-translate-y-0.5',
            )}
          >
            <Trash2 size={11} strokeWidth={3} aria-hidden="true" />
            移除
          </button>
        </div>
      </div>
    </div>
  );
}
