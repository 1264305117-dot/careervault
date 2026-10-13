#!/usr/bin/env bash
# ============================================================================
# 生职迹 Career Trail · 服务器一键初始化脚本（careervault.cn）
#
# 前置条件（缺一不可，脚本会逐项检查）：
#   1. 项目代码已上传到 /opt/shengzhiji（含 webapp/ 前端产物与 requirements.txt）
#   2. 以 root 身份运行：sudo bash deploy/server-setup.sh
#   3. 系统为 Ubuntu 20.04 / 22.04 / 24.04（Debian 11+ 亦可）
#
# 做的事：装依赖 → 建服务账号 → 建 venv → 注册 systemd 服务 → 配置 Nginx。
# HTTPS（certbot）留作最后一步手工执行，见脚本末尾提示。
# ============================================================================
set -euo pipefail

APP_DIR="/opt/shengzhiji"
SERVICE_USER="shengzhiji"

# ---------- 前置检查 ----------
if [[ $EUID -ne 0 ]]; then
  echo "错误：请用 sudo 运行本脚本：sudo bash deploy/server-setup.sh" >&2
  exit 1
fi
if [[ ! -d "$APP_DIR" ]]; then
  echo "错误：未找到 $APP_DIR。请先把项目代码上传到该目录（见部署指南第 3 步）。" >&2
  exit 1
fi
if [[ ! -f "$APP_DIR/requirements.txt" ]]; then
  echo "错误：$APP_DIR 下没有 requirements.txt，上传的目录结构不对。" >&2
  exit 1
fi
if [[ ! -d "$APP_DIR/webapp" ]]; then
  echo "错误：$APP_DIR 下没有 webapp/（前端构建产物）。请在开发机上先 npm run build 再上传。" >&2
  exit 1
fi

echo "==> 1/6 安装系统依赖（nginx / python venv / certbot）"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx python3 python3-venv certbot python3-certbot-nginx >/dev/null

echo "==> 2/6 创建服务账号 $SERVICE_USER（无登录权限，仅用于跑应用）"
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

echo "==> 3/6 创建 Python 虚拟环境并安装依赖"
cd "$APP_DIR"
python3 -m venv .venv
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

echo "==> 4/6 目录权限：代码归 root，运行目录归服务账号"
# data/ 是用户简历数据（SQLite），必须可写；其余只读即可
mkdir -p "$APP_DIR/data"
chown -R root:root "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR/data"
chmod 750 "$APP_DIR/data"

echo "==> 5/6 注册 systemd 服务（开机自启 + 崩溃自动拉起）"
cp "$APP_DIR/deploy/shengzhiji.service" /etc/systemd/system/shengzhiji.service
systemctl daemon-reload
systemctl enable --now shengzhiji
sleep 2
systemctl --no-pager --lines=3 status shengzhiji || true

echo "==> 6/6 配置 Nginx 站点（careervault.cn）"
cp "$APP_DIR/deploy/nginx-shengzhiji.conf" /etc/nginx/sites-available/shengzhiji.conf
ln -sf /etc/nginx/sites-available/shengzhiji.conf /etc/nginx/sites-enabled/shengzhiji.conf
# 关掉默认站点，避免占用 80 端口的默认 server_name
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo
echo "============================================================"
echo "初始化完成！接下来："
echo "  1) 确认域名 DNS 已解析到本机公网 IP（ping careervault.cn）"
echo "  2) 配置 HTTPS（免费证书，自动续期）："
echo "     sudo certbot --nginx -d careervault.cn -d www.careervault.cn"
echo "  3) 浏览器打开 https://careervault.cn 验收"
echo ""
echo "常用运维命令："
echo "  systemctl status shengzhiji      # 看应用状态"
echo "  journalctl -u shengzhiji -f      # 看实时日志"
echo "  systemctl restart shengzhiji     # 更新代码后重启"
echo "  ls /opt/shengzhiji/data/         # 用户数据都在这里（记得定期备份）"
echo "============================================================"
