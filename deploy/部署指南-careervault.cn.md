# 生职迹 Career Trail 部署指南 · careervault.cn

> 目标：把应用部署到你自己的服务器，通过 **https://careervault.cn** 访问。
> 前提：careervault.cn 已完成 ICP 备案（你已办好）。
> 全程预计 30–60 分钟，其中大头是等服务器开机和 DNS 生效。

---

## 第 1 步：买一台轻量云服务器

**关键提醒——备案接入商要对上**：
ICP 备案是挂在某一家云服务商名下的（备案信息里有「接入商」一栏）。买服务器时：

- **备案在哪家做的，就买哪家的服务器**（登录备案所在的服务商控制台，查看备案信息即可确认）；
- 如果备案接入商是 A、服务器却买了 B 家，需要在 B 家做「**新增接入备案**」（免费，但要多等几天审核），期间网站可能被阻断。

**推荐配置**（以腾讯云轻量应用服务器为例）：

| 项目 | 建议 |
|---|---|
| 地域 | 国内任意（备案过的域名必须用国内节点） |
| 镜像 | **Ubuntu 22.04** 或 24.04 |
| 配置 | 2 核 2G 起步（本应用很轻，够用） |
| 流量 | 每月 300GB+ 的套餐即可 |

买完记下两样东西：**公网 IP**、**root 密码**（或密钥对）。

**防火墙**：在服务器控制台的「防火墙」页确认放行了 **80、443** 端口（TCP）。

## 第 2 步：域名 DNS 解析

到域名管理控制台（域名在哪买的就去哪家，如腾讯云 DNSPod / 阿里云）加两条记录：

| 记录类型 | 主机记录 | 记录值 |
|---|---|---|
| A | `@` | 服务器公网 IP |
| A（或 CNAME 到 @） | `www` | 同上 |

保存后等 5–10 分钟，在本地终端验证：

```bash
ping careervault.cn    # 应返回你服务器的 IP
```

## 第 3 步：把代码上传到服务器

**先确认本地是最新构建**（webapp/ 是前端产物，必须带上）：

```bash
cd /Users/yangmenglei/Documents/kimi/tasks/2026-10-12/06-50-25-d7568a08/careervault
npm run build
```

然后在本地终端执行上传（把 `服务器IP` 换成实际 IP）：

```bash
rsync -avz --progress \
  --exclude node_modules --exclude .venv --exclude .git \
  --exclude data \
  ./ root@服务器IP:/opt/shengzhiji/
```

> 首次连接会问是否信任主机指纹，输 `yes`；然后输 root 密码。
> `data/` 被排除是刻意的：本地 data 里是你开发测试的数据，不要带上服务器。
> 如果你的 Mac 连服务器用的是密钥而非密码，rsync 命令不变。

## 第 4 步：服务器上跑一键初始化

SSH 登录服务器，执行：

```bash
ssh root@服务器IP
cd /opt/shengzhiji
sudo bash deploy/server-setup.sh
```

脚本会自动：装 Nginx / Python 环境 → 建服务账号 → 装依赖 → 注册 systemd 服务（开机自启、崩溃自动拉起）→ 配置 Nginx。每一步失败都会明确报错。

## 第 5 步：配 HTTPS 证书（免费、自动续期）

```bash
sudo certbot --nginx -d careervault.cn -d www.careervault.cn
```

按提示输入邮箱、同意条款即可。certbot 会自动修改 Nginx 配置加上 443 和证书，并设置自动续期（systemd timer），以后不用管。

## 第 6 步：验收

浏览器打开 **https://careervault.cn**，应看到「生职迹」首页。再快速过一遍核心功能：记录一段经历 → 生成简历 → 导出 PDF/Word。

服务器上常用命令：

```bash
systemctl status shengzhiji     # 应用状态
journalctl -u shengzhiji -f     # 实时日志（排查问题先看这个）
systemctl restart shengzhiji    # 重启应用
```

---

## 日常运维

**更新代码**（改完功能要同步到服务器时）：

```bash
# 本地：重新构建 + 上传（data 目录依然排除，不会动线上数据）
npm run build
rsync -avz --exclude node_modules --exclude .venv --exclude .git --exclude data \
  ./ root@服务器IP:/opt/shengzhiji/

# 服务器：重启服务
ssh root@服务器IP "systemctl restart shengzhiji"
```

**数据备份**：所有用户的简历数据都在服务器的 `/opt/shengzhiji/data/` 目录（每台设备一个 SQLite 文件）。定期打包备份：

```bash
ssh root@服务器IP "tar czf /root/shengzhiji-data-$(date +%F).tar.gz -C /opt/shengzhiji data"
scp root@服务器IP:/root/shengzhiji-data-*.tar.gz ~/Backups/
```

---

## 两个必须知道的事

### 1. 云端 AI 能力在自有域名下不可用（会自动降级，不会坏）

现在线上版的 AI 能力（STAR 提炼、生成简历、JD 匹配、面试追问、简历解析）走的是 WorkBuddy 云服务通道，它按来源域名（Origin）精确放行 `careervault.app.workbuddy.host`，**换成 careervault.cn 后这些云端请求会被拒**。

应用本身已内置降级：云端不可用时自动回落**本地规则引擎**，功能都能用，只是 AI 生成质量明显下降。

**解法**：接一个你自己的大模型 API（如 DeepSeek / 通义 / 智谱，都很便宜，DeepSeek 生成一份简历约几分钱）。把 API Key 给我，我来改代码接上——改完后两个版本（WorkBuddy 线上版 + careervault.cn 版）可以同时用各自的 AI 通道。

### 2. 这是两套独立实例，数据不互通

- **https://careervault.app.workbuddy.host**（WorkBuddy 线上版）：数据在 WorkBuddy 沙箱，继续可用、互不影响；
- **https://careervault.cn**（自有服务器版）：全新空库，各设备的简历数据存在你自己服务器的 `data/` 目录。

两边可以同时在线。想只保留一个的话，告诉我，我帮你下线另一个。
