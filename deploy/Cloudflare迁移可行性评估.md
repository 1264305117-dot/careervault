# Cloudflare 迁移可行性评估 · 生职迹 Career Trail

> 评估时间：2026-10-14 ｜ 结论先行：**技术可行，但免费套餐跑不了完整功能，最低成本 $5/月 + 1–2 天改造工作量**。与已备好的 careervault.cn 服务器方案（¥50–100/月，零改造）相比没有优势。

## 平台现状（2026-09 起）

Cloudflare Python Workers 已于 2026-09-21 正式 GA：FastAPI 通过官方 ASGI 连接器原生运行，纯 Python 依赖可直接安装。本项目后端理论上能整体搬上去。

## 逐项验证结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| FastAPI 运行 | ✅ | 官方支持：`from workers import asgi; Default = asgi.entrypoint(app)` |
| reportlab（PDF 导出） | ⚠️ 可装但有硬伤 | 5.0.1 提供纯 Python wheel，可安装；**但**——见下面两个红牌 |
| python-docx（Word 导出） | ✅ | 纯 Python wheel；其依赖 lxml 是 Pyodide 内置包 |
| pypdf（简历解析） | ✅ | 纯 Python wheel |
| python-multipart（上传） | ✅ | 纯 Python wheel |
| 前端静态资源 | ✅ | Workers Static Assets 直接托管 webapp/ |
| 数据持久化 | ❌ 需重写 | Workers 文件系统是**临时的**（isolate 销毁即丢）；SQLite 必须迁到 D1 或 Durable Objects |

## 三张红牌

### 红牌 1：免费套餐 CPU 限额跑不动 PDF 导出

Workers 免费版每请求 **10ms CPU**，付费版（$5/月）才是 30 秒。本应用导出 PDF 时要解析并子集化 **10.5MB 的 NotoSansSC 中文字体**（reportlab 的 TTF 解析是重 CPU 操作），单次导出轻松超过免费限额一个数量级。Word 导出没这个问题。

**结论：要完整功能至少 Workers Paid，$5/月起。**

### 红牌 2：数据层必须重写（约 1 天）

现在每个设备的简历数据是独立的 SQLite 文件（`data/*.db`）。Workers 上没有本地磁盘，两个选择：

- **Durable Objects**（每设备一个 DO 实例 + 各自 SQLite）：隔离语义保留最好，但 db.py 的连接层要整体换掉，且 Python 编写 DO 的支持细节需实测；
- **D1 单库 + owner 字段**：所有表加设备标识列、所有查询加过滤——改动面铺到每一个 router。

两条路都是「能做但不是小活」。

### 红牌 3：字体包体积逼近限额

Worker 包上限 **64MiB**：两份 NotoSansSC（共 21MB）+ Pyodide 运行时 + 依赖，能塞下但很挤；稳妥做法是用 fonttools 把字体子集化到常用字符集（约 2–4MB），这本身又是一块改造 + 回归测试。

## 附带影响（非阻塞但要改）

- **AI 能力**：WorkBuddy 云服务按 Origin 放行，CF 域名下不可用（与 careervault.cn 方案同样的问题）。可选替代：Workers AI（有免费额度）或用户自己的 LLM Key，需要改 `src/lib/ai.ts` + `api/ai.py` 的通道；
- **域名**：careervault.cn 可以托管在 CF，但若主要访客在国内，CF 免费版无中国网络加速，速度一般。

## 成本与方案对比

| 方案 | 月成本 | 改造量 | 域名 | 风险 |
|---|---|---|---|---|
| Cloudflare Workers | **$5（约 ¥36）** | 1–2 天（数据层重写 + 字体子集 + AI 通道） | careervault.cn 可用 | DO/D1 细节需实测，导出性能待验证 |
| 轻量服务器（已备好部署包） | ¥50–100 | **零**（deploy/ 一键脚本） | careervault.cn | 极低 |
| 维持 WorkBuddy 线上版 | ¥0 | 零 | careervault.app.workbuddy.host | 无 |

## 建议

除非你特别想要 CF 的边缘架构（或已有付费套餐），**性价比排序是：轻量服务器 > 维持现状 > Cloudflare**。若确认仍要迁移，第一步是搭 pywrangler 本地环境做 PDF 导出 CPU 实测（红牌 1 的最终裁决），再动数据层。
