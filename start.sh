#!/bin/sh
# 「生职迹」线上启动脚本：单端口同时服务前端静态页与 /api。
# 发布沙箱会把 PORT 环境变量注入进来（默认 8000 兜底，本地手工跑也方便）。
set -e
cd "$(dirname "$0")"
exec python3 -m uvicorn api.main:app --host 0.0.0.0 --port "${PORT:-8000}"
