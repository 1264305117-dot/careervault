# 生职迹 Career Trail

个人经历库 + AI 简历工作台：把求职路上散落各处的实习、项目、校园、科研经历沉淀成结构化素材库，一键匹配岗位、生成多版式简历、导出 PDF / Word。

线上演示：https://careervault.app.workbuddy.host/

## 功能

- **经历库**：六类经历（实习 / 项目 / 校园 / 科研 / 教育 / 技能）分类记录，STAR 结构化提炼，回收站可撤回
- **AI 能力**：经历 STAR 提炼、简历文件智能解析（PDF/Word 导入）、岗位 JD 匹配、AI 生成简历、面试追问预测；云端模型不可用时自动回落本地规则引擎
- **简历工坊**：5 套版式（经典求职 / 简约现代 / 时间轴 / 色带 / 醒目大字），在线编辑所见即所得，PDF 与 Word 双格式导出，中文排版细节（避头点、三段式条目对齐）逐项处理
- **数据自主**：无账号体系，按设备标识隔离存储；一键备份 / 恢复 JSON

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS（黏土拟物设计系统，设计令牌集中于 `src/index.css`）
- **后端**：Python FastAPI + SQLite（每设备独立库文件，结构性数据隔离）
- **导出引擎**：ReportLab（PDF）+ python-docx（Word），同一套版式描述在 Web / PDF / Word 三套渲染引擎上对齐输出

## 本地开发

```bash
# 后端（Python 3.10+）
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn api.main:app --port 8000 --reload

# 前端（Node 18+，另开终端）
npm install
npm run dev   # vite dev server，/api 代理到 8000
```

构建前端产物到 `webapp/`（后端会自动挂载为站点根）：

```bash
npm run build
```

## 部署

单端口同时服务前端与 `/api`，任何能跑 Python 的环境都可以托管：

- **自有服务器**（Nginx + systemd，见 `deploy/` 目录）：`deploy/部署指南-careervault.cn.md` 提供完整步骤与一键初始化脚本
- 通用方式：`PORT=8000 sh start.sh`，前面挂任意反向代理即可

## 目录结构

```
api/          FastAPI 后端（数据层 / AI / 导出 / 备份）
src/          React 前端源码
design-system/ 设计系统文档（版式 / 令牌）
deploy/       自托管部署包（Nginx / systemd / 初始化脚本 / 指南）
webapp/       前端构建产物（npm run build 生成，不入库）
data/         运行时 SQLite 数据（不入库）
```
