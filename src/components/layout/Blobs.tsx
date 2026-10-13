/**
 * Blobs —— 背景彩色光斑层。
 *
 * 设计系统明确要求：**不允许用纯色平铺背景**。
 * 这几颗半透明的模糊圆球是整套玻璃黏土材质的"光源"——
 * 卡片之所以能透出颜色，靠的就是身后的它们。
 *
 * 实现取舍：
 *   - 固定定位 + -z-10，不参与文档流，不产生滚动条
 *   - 用 vh 尺寸，天然随视口缩放（移动端不需要单独适配）
 *   - 三段不同周期的漂浮动画 + 错峰延迟，让背景永远在"缓慢移动"
 *   - pointer-events-none，绝不抢交互
 */
export function Blobs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[10%] -top-[12%] h-[62vh] w-[62vh] animate-clay-float rounded-full bg-[#8B5CF6]/10 blur-3xl" />
      <div className="absolute -right-[12%] top-[16%] h-[54vh] w-[54vh] animate-clay-float-delayed rounded-full bg-[#EC4899]/10 blur-3xl" />
      <div className="absolute -bottom-[16%] left-[24%] h-[58vh] w-[58vh] animate-clay-float-slow rounded-full bg-[#0EA5E9]/10 blur-3xl" />
      <div
        className="absolute right-[6%] bottom-[2%] h-[40vh] w-[40vh] animate-clay-float rounded-full bg-[#10B981]/10 blur-3xl"
        style={{ animationDelay: '2s' }}
      />
    </div>
  );
}
