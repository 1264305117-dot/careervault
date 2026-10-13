# Design System Master File — 职历库 CareerVault

> **LOGIC:** 写页面前先看本文档；本文档描述的是**已实现**的设计系统（v1.3 起）。
> 令牌唯一真源：`src/index.css` 的 `:root`；原语组件：`src/components/cv/`。

---

**Project:** 生职迹 Career Trail
**Style:** High-Fidelity Claymorphism（高保真黏土拟物）
**Since:** v1.3（2026-10-13，替换掉 v1.2 的 Minimalist Modern）
**核心概念:** 数字黏土。界面不是平面，而是一堆被柔和顶光照射的实体——
外阴影定义离地高度、左上高光模拟受光面、内阴影做边缘反弹光。

---

## 1. 三条铁律

1. **材质先于颜色**：任何元素先决定它是「凸起 / 凹陷 / 玻璃」三态之一，
   再决定颜色。凸起用 `shadow-clayButton/clayCard/claySoft`，凹陷用
   `shadow-clayPressed(clayPressedSm)`，玻璃用 `clay-glass`。
   **禁止**直接使用 Tailwind 默认的黑色投影（`shadow`/`shadow-md` 语义已被令牌层覆盖为黏土投影）。
2. **没有尖角**：圆角下限 14px（`rounded-sm`）。卡片 `rounded-clay-lg`(32px)，
   面板 `rounded-clay-xl`(40px)，按钮/输入 `rounded-md`(20px)，徽章/胶囊 `rounded-full`。
3. **双字体分工**：`Nunito`（700/800/900）做标题、数字、标签、按钮——圆润终端正是黏土的语气；
   `DM Sans` 做正文。**不再使用等宽字体**（标签用 Nunito 大写 + `tracking-[0.15em]`）。
   中文回退苹方/雅黑。

---

## 2. 颜色令牌（RGB 通道值，写在 `index.css :root`）

| Token | 值 | 用途 |
|---|---|---|
| `--cv-bg` | `244 241 250` `#F4F1FA` | 画布（淡薰衣草白，**禁止纯白**） |
| `--cv-card` | `255 255 255` | 实心白（仅用于聚焦后的输入框） |
| `--cv-surface` | `239 235 245` `#EFEBF5` | 凹陷表面（输入框、数据格） |
| `--cv-border` | `227 221 240` | 极软分隔线（黏土世界几乎没有硬边框） |
| `--cv-fg` | `51 47 58` `#332F3A` | 主文字（软炭黑） |
| `--cv-muted-fg` | `99 95 105` `#635F69` | 次文字（**最浅下限**，再浅不达 AA） |
| `--cv-accent` | `124 58 237` `#7C3AED` | 紫罗兰：主 CTA、链接、激活态 |
| `--cv-accent-2` | `167 139 250` `#A78BFA` | 渐变浅端（`from-accent-2 to-accent`） |
| `--cv-pink` | `219 39 119` `#DB2777` | 热粉：第二情绪、标题渐变尾色 |
| `--cv-sky` | `14 165 233` | 天蓝：信息类、页头图标球 |
| `--cv-ok` / `--cv-warn` / `--cv-danger` | 翡翠/琥珀/糖果红 | 语义色 |

**色彩策略**：色相只出现在「面积最小的辨认元素」上——图标球、类型胶囊的渐变小圆、
统计球。文字永远是深炭色，页面才不会变成彩虹。

---

## 3. 阴影栈（黏土物理引擎，全部定义在 `index.css :root`）

| Tailwind 类 | 变量 | 物理含义 |
|---|---|---|
| `shadow-clay` | `--sh-clay` | 深陷入地面的大容器（几乎不用） |
| `shadow-clayCard` | `--sh-card` | 标准悬浮卡片（4 层） |
| `shadow-clayCardHover` | `--sh-card-hover` | 卡片 hover（抬得更高） |
| `shadow-clayButton` / `Hover` | `--sh-button` | 强凸起，带自身色相投影 |
| `shadow-clayPressed(Sm)` | `--sh-pressed` | 凹陷（输入框、按下的按钮） |
| `shadow-claySoft` | `--sh-soft` | 轻凸起（小徽章、胶囊） |
| `shadow-clayOrb` | `--sh-orb` | 圆形统计球 |

规则：四层结构 = 外投影（离地）+ 左上高光（受光）+ 内彩色反弹 + 内边缘光。
面板用自己的色相投影（`ClayPanel` 内联），灰投影只给无色相的表面。

---

## 4. 原语组件（`src/components/cv/`）

| 组件 | 说明 |
|---|---|
| `Button` | 7 variant。**每屏最多 1 个 `primary`**（紫罗兰渐变）。按下 = `scale-[0.92]` + inset 阴影（"捏扁"） |
| `Card` | 玻璃黏土容器。`elevation`/`tone`/`radius`/`interactive` 四组变体；hover 抬升 8px |
| `ClayPanel` | 彩色渐变凸起面板（统计带、匹配得分）。tone: violet/pink/sky/ink |
| `Orb` | 圆形统计球。`onPanel` 用于彩色面板上的反白形态；激活时 `clay-breathe` 呼吸 |
| `Input/Textarea/Select` | 凹陷槽；focus 时"弹"成白色凸起面 + 薰衣草光环 |
| `SectionTitle` | 卡片内分节标题（渐变小球 + Nunito 粗体） |
| `Badge` 族 | `SectionLabel` 眉标 / `TypeBadge` 类型胶囊（含渐变小图标球）/ `Chip` 过滤 / `EngineBadge` / `StatusDot` / `TagList` |
| `IconTile` | 渐变图标球（violet/pink/sky/emerald/amber 交替，避免单色疲劳） |
| `Task` 族 | `TaskAccordion` 手风琴式任务清单（**经历卡片默认用**：任务标题常显，点开一项才摊开它的 S/T/A/R，可多项同开）/ `TaskList` 全摊开只读（导入解析预览用，那一步要逐条校对）/ `TaskEditor` 可编辑。**S/T/A/R 四颗色相小球**（S 天蓝 / T 琥珀 / A 紫罗兰 / R 翡翠）承担字段辨认，正文保持深炭色；R 加粗强调。同值去重（本地引擎可能让 A 与 R 是同一句） |
| `PageHeader` | 页头：图标球 + 眉标 + Nunito Black 大标题（尾词糖果渐变）+ 动作 |
| `EmptyState` | 虚线玻璃卡 + 悬浮渐变球 |
| `Reveal` | 入场动画（IntersectionObserver + CSS，带回弹曲线，零依赖） |
| `VaultSwitcher`（v1.5） | 经历库切换器，双形态：`panel`（经历总览页完整管理：库卡片 + 当前徽章 + 重命名/删除 + 新建）与 `bar`（侧边栏紧凑 select + 新建按钮）。一个库 = 一个人的完整工作区（他的经历 + 简历），切换后全站数据跟着走。**v1.5.1：删除改为每张卡片右上角的垃圾桶图标、一键生效**（只剩一个库时禁用），不弹确认框——依赖回收站与撤销条兜底 |
| `TemplatePicker`（v1.5） | 简历版式选择器：5 张抽象示意小卡（按 `header` 形态画，formal 另画右上角证件照），选中项用主色描边 `0 0 0 2.5px`；选择即时换肤纸张与分区标题，并记住偏好（`cv_resume_template`） |
| `PhotoField`（v1.5） | 证件照字段：未选是虚线"加证件照"，已选显示圆角缩略图 + 换/移除；`onDark` 供色带页头反白形态，`hideControls` 供成品预览态。上传在前端 canvas 压到长边 320px、统一输出 JPEG（铺白底防 PNG 透明变黑），以 data URL 存进简历内容。**v1.6：缩略图从 7.5rem 缩到 w-24（96px），导出照片 26x34mm → 21x28mm（一寸比例），formal 用近乎直角裁切** |
| `UndoBar`（v1.5.1） | 底部撤销条：删除经历库后出现，主文案 + 次文案 + 撤销按钮 + 10 秒倒计时进度（deadline 计时，不被后台节流骗到）。它**不是确认框**——删除已生效，这里把后悔权还给用户；数据在服务端回收站里，撤销只是把快照原样插回 |

**数据结构（v1.4 起）**：一段经历 = 一组 `tasks[]`（每个任务各带 S/T/A/R）
+ 经历级「主线 STAR」（整段经历的一句话概括，只填空缺、不罗列各任务）。
简历里的一条要点 ≈ 一个独立任务；教育/技能仍是条目式，不拆任务。

---

## 5. 动效

- 入场：`cv-reveal`（translateY 32px + scale 0.985 → 0，`cubic-bezier(0.34,1.4,0.64,1)` 回弹）
- 漂浮：`clay-float` 8s / `clay-float-delayed` 10s / `clay-float-slow` 12s（背景光斑、空态球）
- 呼吸：`clay-breathe` 6s（激活的统计球）；`pulse-soft`（状态点）
- 交互：hover `-translate-y-1 ~ 2` + 阴影增强；active `scale-[0.92]` + inset 阴影
- 全部尊重 `prefers-reduced-motion`（`index.css` 尾部统一关闭）

---

## 6. 布局与背景

- **背景永远不是纯色**：`<Blobs/>`（`components/layout/`）固定铺 4 颗 10% 透明度的
  模糊光斑（紫/粉/蓝/绿），玻璃卡片的颜色就是从它们身上透出来的。
- 导航是一块**浮起的独立黏土板**（`w-[16.5rem]` 内边距 14px + 玻璃面 + clayCard 阴影，
  v1.6.2 从 19rem 收窄——导航项 `py-[7px]`、图标盒 22px、分组间距 space-y-3.5，
  小屏笔记本也能一眼看全所有条目），内容区 `lg:pl-[16.5rem]`；
  移动端收进顶栏黏土条 + 抽屉。
- 内容容器 `max-w-6xl`，竖向留白 `py-6 → lg:py-10`。

---

## 7. 历史版本

- v1.7.0 品牌「职迹」+ 产品首页 + 正式上线（2026-10-13）：
  - **品牌**：职历库 CareerVault → **职迹 Career Trail**（index.html / 侧栏 / API title）；
    品牌标识从 Archive 换成 Route（职业轨迹），侧栏品牌块可点击回首页
  - **产品首页** `src/views/LandingView.tsx`：五屏结构 —— Hero（真实文案的简历纸样张 +
    匹配度/来源浮动标签）→ 三张「痛点 → 它怎么做」对照卡 → 六项能力卡 → 紫色 ClayPanel
    四步流程 → 三条信任卡 → 收尾 CTA。不套 AppShell（落地页无导航板），
    但沿用同一套令牌与组件，从首页进应用没有"换产品"的断裂感
  - **首访策略**：首次打开看首页，点「进入应用」后记 localStorage（cv_seen_landing），
    老用户直达经历总览；侧栏顶部常驻「产品首页」随时可回
  - **上线**：api/main.py 挂 webapp/（vite outDir，刻意不叫 dist——发布通道排除构建产物目录）
    为站点根 + SPA 兜底；start.sh 按 $PORT 起 uvicorn。分享链接
    https://careervault.app.workbuddy.host/ （云服务激活过的应用，域名与 Origin 保持不变）
  - **多设备数据隔离**：每个浏览器生成设备标识（localStorage + `X-CV-Owner` 请求头，
    由 src/lib/device.ts 包一层 window.fetch 全站注入），后端按标识把数据落到
    **各自独立的 SQLite 文件**（api/db.py::db_path）—— 隔离是结构性的，既有查询零改动。
    本机模式（标识为空）仍走 data/careervault.db，老数据与脚本不受影响
  - **下载改造**：`<a href>` 下载带不上设备标识 → PDF/Word/备份导出改走
    fetch+blob（src/lib/download.ts）
- v1.6.5 句号补齐 + 页头瘦身 + 在线/导出同版式（2026-10-13）：
  - **要点句号**：模型压缩语料时习惯省掉句末「。」（导出链路逐字符验证过不丢字，
    是内容源头就没有）。新增句末标点规则——`api/text_rules.py::with_full_stop` ↔
    `src/lib/ai.ts::withFullStop`（同一套：已有终止标点原样返回，尾随逗号/分号先清再补），
    接入前端生成两条路径与 `insertExperience`、后端 `generate_local` 与提示词；
    存量由 `migrate_bullets_period.py` 幂等补齐（resume19 补 18 条，先备份）。
    **刻意放在生成环节而不是导出环节**——编辑/预览/导出读同一份内容，天然一致。
  - **页头两行**：删掉「职业概述」行（前端纸张 + PDF + DOCX + 复制全文都不再渲染；
    `summary` 字段保留在数据里不破坏旧简历）。
  - **在线纸张 = A4 真身**：纸张宽 794px（210mm）、内边距 16/14mm（60.5/53px）、
    min-height 1123px，与 export.py 的 pagesize/margins 逐项对应；字号按 A4@96dpi
    从 pt 换算（姓名 17pt→22.7px、条目标题 10pt→13.3px、日期 8.5pt→11.3px、
    要点 9.5pt/14pt→12.7px/18.7px、栏目标题 11pt→14.7px），三栏比例 1.29fr:1:1.29fr
    = PDF 的 0.36/0.28/0.36。实测：标题/机构/要点文字同一条左缘、圆点悬挂 -11px
    （PDF -11.9px）、中轴偏差 0。
  - **预览态 = 导出件**：要点用 `renderBullet` 渲染（formal「前缀：」加粗，与
    `bullet_markup` 同正则）；空板块/空条目不渲染（同 `output_sections`）；
    没填联系方式不占行；没填姓名时页头显示简历文件名（同导出回落）。
- v1.6.4 每行左对齐 + 页头姓名/联系方式 + 行首不出现标点（2026-10-13）：
  - **所有正文同一条左边界**：根因是 SimpleDocTemplate 的 Frame 默认带 6pt 内边距，
    纯段落整体右移 6pt 而 Table（hAlign 居中）恰好回到页边距 —— 于是
    「栏目标题 51.4pt / 条目机构名 45.4pt / 要点文字 63.4pt」三档错开。
    新增 `_FlushDoc`（Frame padding 全 0）后，栏目标题、条目标题、要点文字
    全部从页边距起笔；**要点圆点悬挂到页边距里**（PDF `bulletIndent=-9`、
    Word 悬挂缩进 -9pt + 0pt 制表位），行与行的文字左缘完全对齐。
    在线编辑器同步：要点行 `-ml-6` 抵掉缩进让文字对齐，formal 条目删除按钮
    改为绝对定位到纸张右侧留白（不再需要左侧 w-8 占位，编辑态也全对齐）。
  - **页头改为「姓名 / 联系方式 / 概述」三行**：第一行姓名、第二行邮箱 · 手机号
    （`ResumeContent.name` / `.contact`，编辑器纸面上直接填；
    `title` 退居为列表文件名，改在顶部工具栏编辑）。老简历没填姓名时导出回落到
    title，不至于开天窗。
  - **行首不再出现标点**：PDF 段落样式加 `wordWrap="CJK"` 启用 reportlab 的避头点；
    reportlab 自带的 `ALL_CANNOT_START` 表缺全角逗号/冒号/分号/问号/叹号/右引号等，
    在 `api/export.py` 模块级补全（`lib.textsplit` 与 `platypus.paragraph` 两处按值
    绑定都要补）。Word 靠自身的中文避头点规则。AI 生成提示词同步加
    「要点/标题开头不能是标点」。
  - **板块标题不再孤悬页底**：PDF 里板块标题与第一条要点一起 `KeepTogether`，
    Word 栏目标题加 `keep_with_next`。
- v1.6.3 校园经历 + 导出排版修正（2026-10-13）：
  - **新增第 6 类经历「校园」**：团支书 / 班委 / 学生会 / 社团 / 创新创业中心等
    在校职务统一归为校园经历。判定关键词唯一真源 `api/exp_types.py::is_campus_role`
    （`CAMPUS_RE`），前端 `src/lib/ai.ts::isCampusRole` 保持同一套——**改一处必须改两处**；
    导入解析（`importer`）、AI 生成提示词、`normalizeExperiences` 三处都会把
    误判成项目/实习的校园职务改判为「校园」。徽章用 indigo（`Badge.TYPE_META.校园`）。
  - **存量迁移 `migrate_campus.py`（项目根，一次性、幂等）**：①`项目/实习` 且命中
    校园关键词 → 改「校园」；②已存简历里对应条目挪进「校园经历」板块
    （标题用 `norm()` 去掉 `·`/空白后宽松比对，解决「2021级投资学2班 · 团支书」
    与经历标题不一致的认领问题）；③顺手清掉空板块/空条目。
    生产库已迁移（改动 2 条类型 + 挪 2 条 + 删 1 个空板块），
    迁移前备份在 `/tmp/cv-backup-before-migrate-*.db` 与 `data/careervault.db.bak-*`。
  - **板块映射**：校园 → 「校园经历」，板块顺序 教育→实习→项目→**校园**→科研→技能
    （前后端 `SECTION_ORDER` / `SECTION_BY_TYPE` 同步）。
  - **导出排版修正**（`api/export.py` + 编辑器同步）：
    - **空板块不再输出**：`output_sections()` 统一清洗，只有标题没有条目的板块
      （如空的「科研经历」）直接丢掉；前端预览态 `dropEmptySections` 同口径。
    - **超长条目标题独占一行**：formal 三段式首栏只有 0.36 幅宽（≈18 个中文字），
      机构名超过 `LONG_HEADING_LIMIT = 16` 字先整行铺满，职位+日期仍在
      「占位首栏 + 中栏 + 右栏」的三栏里（职位依旧压轴对称线）；
      时间轴版式阈值 `LONG_HEADING_LIMIT_WIDE = 30`。
    - **栏目标题前空一小行**：PDF 每个板块前 `SECTION_GAP_MM = 4`mm Spacer，
      Word 标题段落 `space_before = 10pt`；在线编辑器对应 `mt-[15px]`。
    - **在线行距对齐产出文件**：要点 `leading-[19px]`（≈PDF 9.5pt/14pt），
      要点间距 `mt-0.5 + py-0`（≈PDF leading+spaceBefore = 20px）。
  - **经历库面板删掉说明句**「一个经历库 = 一个人的完整资料……」（用户要求）。
- v1.6.2 侧边栏瘦身 + 经典求职版式周正化（2026-10-13）：
  - **侧边导航收紧**：栏宽 19rem → 16.5rem；品牌区 / 导航项 / 经历库条 / AI 引擎卡
    全部降一档（导航项 `py-3` → `py-[7px]`、图标盒 28 → 22px、分组间距 24 → 14px、
    卡片内边距 16 → 12px），可视条目数明显变多，气质不变。
  - **经典求职（formal）排到模板选择器第一位**（前后端 `TEMPLATES` 顺序同步调整；
    `DEFAULT_TEMPLATE` 仍是 classic，老简历不因排序改版式）。
  - **去掉 formal 页头通栏黑线**：证件照贴在页头右侧，通栏线会从照片底下穿过去、
    把纸面切成上下两块；去掉后页头与第一个板块之间补 4mm 呼吸（PDF 同步）。
  - **轴对称线（周正感）**：三段式条目行改为**左右等宽三栏**
    （前端 `grid-cols-[1.15fr_1fr_1.15fr]`、PDF `0.36/0.28/0.36`、Word 居中制表位
    取正文宽度一半 89mm）——「战略实习生」这类职位文字精确落在纸面中轴
    （实测偏差 0px）；居中页头 + 证件照时左侧补一块与照片等宽的空白
    （Word 用 `set_col_widths` 固定 tblGrid 22/134/22mm），姓名同样压在轴上。
    编辑态右侧的删除按钮也在左侧补了等宽占位，编辑/预览两态轴线不跳。
  - **Word 导出对齐 PDF**：页面从 python-docx 默认的 Letter 改为 A4 + 16/14mm 页边距
    （正文宽度 178mm，与 PDF 一致），时间轴右制表位同步改 178mm。
- v1.6.1 去亮点提炼 + 教育/技能真分条（2026-10-13）：
  - **去掉"小灯泡亮点提炼"**：经历总览卡片不再把 R（结果）拎出来做渐变强调块；
    R 回到它本来的位置——展开「主线 STAR」里的 `R · 结果`；卡片摘要只显示
    整体在做什么（A/T/S）。岗位匹配列表、导入确认页同样去掉了灯泡强调
    （内容降为普通文本，岗位匹配页的"准备建议"灯泡保留——那不是经历亮点）。
  - **教育 / 技能真分条**：分条规则收敛为唯一真源 `src/lib/infolines.ts` ↔ `api/infolines.py`
    （改一处必须改两处）——①硬换行必断；②分号/句号只在"后一段以新小节标签
    （如「英语：」「获奖经历：」）开头"时断，段内分句连同原分隔符照抄回来；
    ③整段无标签才逐句全拆。v1.6 的旧兜底会把「产品&数据分析：…；SQL…；Vibe Coding」
    拆成三条，正是用户看到的问题。
  - **四层落地**：①导入时按行存储（本地解析 `_add_line` 用 `\n` 连接、
    云端解析结果在 normalizeExperiences / confirm_import 归一成一行一条）；
    ②启动时幂等迁移 `init_db::normalize_info_storage`——把老数据里一整段的
    教育/技能原文补上换行、把已保存简历里被模型拆碎的空标题条目合并
    （不增删任何字符，逐字校验通过；重启只跑一次）；③界面（总览卡片、
    编辑器内容框、导入确认）按行分条渲染；④生成简历时条目先接回一段
    再按小节重分条、无标题条目合并成一条（`normalizeInfoSections`，与后端
    `generate_local::_info_bullets` 同规则），并用真实数据单测通过。
  - **编辑器类型感知**：教育 / 技能的经历表单不再是 STAR 四格 +
    AI 提炼 + 任务清单（既成事实不需要提炼），换成单个「内容（一行一条）」
    文本域；`bulletsOf`（从经历库插入简历）对这两类直接用原文分条。
- v1.6 经典求职版式 + 字号瘦身 + 教育/技能分条（2026-10-13）：
  - **第 5 套模板 `formal` 经典求职**：黑白一栏式，复刻纸质简历惯例——
    居中姓名 + 居中概述、右上角近乎直角证件照、黑细线分区标题、
    条目行三段式（机构居左 · 职位居中 · 日期居右，heading 约定「机构 · 职位」按 `·` 拆）、
    要点里 16 字内的「前缀：」自动加粗（PDF 用 `<b>`，Word 拆 run）。
    编辑器里 heading 拆成"机构/职位"两个输入框，数据层仍是一个字段。
  - **全局字号瘦身**：导出姓名 20-27pt → 17-21pt、分区标题 12-15 → 10.5-12.5、
    正文 10 → 9.5、页边距收至 14/16mm；编辑器标题/分区/要点同步缩小
    （text-3xl→2xl、text-base→text-[15px]、text-sm→text-[13px]）。
    实测原来两页的内容稳稳一页装下。
  - **教育 / 技能原文分条展示**：内容仍逐字沿用（一个字不改），但必须一条一行——
    提示词（GENERATE_SYSTEM）明确要求"每个小节单独一条"；
    云端返回后还有确定性兜底 `splitInfoLines`：只在硬换行或"后一段以新标签（如「核心课程：」「英语：」）开头"
    的分号/句号处断条，其余分号视为同一条目内部的并列照抄回来；
    全段无标签导致并成一行时退回逐段全拆。本地兜底引擎 `generate_local` 同规则。
    附带去重：条目标题与板块名相同（技能板块下的"个人技能"）不再展示两遍。
- v1.5.1 一键删除经历库 + 回收站（2026-10-13）：
  - 删除入口改为每张库卡片右上角的垃圾桶图标，**点一下即生效**（不弹确认框），
    只剩一个库时按钮禁用。
  - 三层保护代替确认框：① 删除在同一个事务里把整库快照搬进本机 `vault_trash` 表
    （`DELETE /api/vaults/{id}` 返回 `trash_id`）；② 底部 `UndoBar` 十秒内一键撤销
    （`POST /api/vaults/trash/{id}/restore`，连条目 id 都原样恢复）；③ 「数据备份」页
    新增回收站卡（列表 / 恢复 / 彻底删除 / 清空，保留最近 20 条）。
  - 设计要点：确认框是给"不可逆"准备的成本；既然数据没离开本机，
    就把顺手还给用户，把风险兜在产品里。
- v1.5 多经历库 + 简历换肤 + 证件照（2026-10-13）：
  - **经历库（Vault）成为一等实体**——一个库 = 一个人的完整工作区（他的经历 + 简历），
    用于"帮朋友建库"：总览页 `VaultSwitcher` 面板建库/重命名/删除（拒绝删最后一个库），
    侧边栏 `bar` 形态随时切换；当前库记忆在 `localStorage['cv_current_vault']`，
    经历 / 简历 / 导入去重 / AI 匹配 / 生成 / 面试全部按 `vault_id` 隔离。
    备份格式升到 1.2（含 vaults，老备份内容回落默认库）。
  - **简历版式模板 4 套**（`classic` 经典居中 / `band` 现代色带 / `timeline` 时间轴 / `bold` 醒目大字）：
    前后端共用同一套皮肤定义（`src/lib/resume-templates.ts` ↔ `api/export.py` 的 `TEMPLATES`），
    每套 = `accent` 主色 + `header` 页头形态 + `section` 分区标题形态；
    编辑器即时换肤，导出 PDF / Word 与所见一致；选择记住偏好。
  - **证件照**：`PhotoField` 上传后前端压到长边 320px JPEG（data URL 存进简历内容，
    不引入文件服务器），PDF 用圆角裁切 Flowable、Word 用 `add_picture`，按版式放到页头。
    编辑器新增「效果预览」开关：只读 + 隐藏全部编辑装饰与模板/照片/插入面板。
- v1.4 任务级 STAR：解析不再把整段经历的要点塞进 `star_a`，改为按要点拆任务、
  每任务独立识别 S/T/R；`TaskList` / `TaskEditor` 上线，数据库新增 `experiences.tasks` 列。
  卡片交互随后调整为：**任务清单常显（手风琴，点任务名展开其 STAR）**，
  卡片右上箭头只负责「主线 STAR」，无主线内容时箭头隐藏。
- v1.2 Minimalist Modern（电光蓝 + 深色反转栏 + Calistoga/Inter/JetBrains Mono）——已整体替换。
  过渡期别名 `cv.primary / cv.secondary / cv.destructive` 仍保留（映射到紫罗兰/天蓝/糖果红）。
