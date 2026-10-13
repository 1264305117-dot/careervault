/**
 * 生职迹 Career Trail — Tailwind 主题
 *
 * 设计系统：High-Fidelity Claymorphism（见 src/index.css 与 design-system/careervault/MASTER.md）
 * 令牌的**唯一真源**是 src/index.css 的 :root（RGB 通道值 + 阴影栈），
 * 这里只做「CSS 变量 → Tailwind 类名」的映射，不在本文件里写死颜色或阴影。
 *
 * 命名约定：
 *   cv-*        → 产品语义令牌（写业务代码时优先使用）
 *   clay*       → 黏土材质（阴影栈 / 玻璃面）
 *   background/foreground/muted/border… → shadcn 约定命名，映射到同一套令牌，
 *                                          供 src/components/ui 下的原语复用
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ---------- shadcn 约定命名（映射到同一套令牌，勿单独改值） ----------
        border: 'rgb(var(--cv-border) / <alpha-value>)',
        input: 'rgb(var(--cv-border) / <alpha-value>)',
        ring: 'rgb(var(--cv-accent) / <alpha-value>)',
        background: 'rgb(var(--cv-bg) / <alpha-value>)',
        foreground: 'rgb(var(--cv-fg) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--cv-card) / <alpha-value>)',
          foreground: 'rgb(var(--cv-fg) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--cv-card) / <alpha-value>)',
          foreground: 'rgb(var(--cv-fg) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'rgb(var(--cv-accent) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--cv-muted) / <alpha-value>)',
          foreground: 'rgb(var(--cv-fg) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--cv-muted) / <alpha-value>)',
          foreground: 'rgb(var(--cv-muted-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--cv-muted) / <alpha-value>)',
          foreground: 'rgb(var(--cv-fg) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--cv-danger) / <alpha-value>)',
          foreground: 'rgb(255 255 255 / <alpha-value>)',
        },

        // ---------- 产品语义令牌（业务代码优先使用） ----------
        cv: {
          bg: 'rgb(var(--cv-bg) / <alpha-value>)',
          fg: 'rgb(var(--cv-fg) / <alpha-value>)',
          card: 'rgb(var(--cv-card) / <alpha-value>)',
          /** 凹陷表面：输入框、内嵌面板的填充色 */
          surface: 'rgb(var(--cv-surface) / <alpha-value>)',
          muted: 'rgb(var(--cv-muted) / <alpha-value>)',
          'muted-fg': 'rgb(var(--cv-muted-fg) / <alpha-value>)',
          border: 'rgb(var(--cv-border) / <alpha-value>)',
          /** 最深色：深色胶囊 / 凸起块上的文字 */
          ink: 'rgb(var(--cv-ink) / <alpha-value>)',
          /** 主强调色：紫罗兰。CTA、链接、焦点环 */
          accent: 'rgb(var(--cv-accent) / <alpha-value>)',
          /** 渐变的浅色端，与 accent 组成主按钮渐变 */
          'accent-2': 'rgb(var(--cv-accent-2) / <alpha-value>)',
          /** 热粉：渐变里的第二情绪、次要强调 */
          pink: 'rgb(var(--cv-pink) / <alpha-value>)',
          /** 天蓝：信息类元素 */
          sky: 'rgb(var(--cv-sky) / <alpha-value>)',
          ok: 'rgb(var(--cv-ok) / <alpha-value>)',
          warn: 'rgb(var(--cv-warn) / <alpha-value>)',
          danger: 'rgb(var(--cv-danger) / <alpha-value>)',

          // 过渡期别名：尚未迁移到新原语的历史页面仍在使用。
          // primary → 主强调色紫罗兰（旧版是藏青）；secondary → 天蓝；destructive → 危险红。
          primary: 'rgb(var(--cv-accent) / <alpha-value>)',
          secondary: 'rgb(var(--cv-sky) / <alpha-value>)',
          destructive: 'rgb(var(--cv-danger) / <alpha-value>)',
        },
      },

      fontFamily: {
        // 正文：DM Sans（几何、干净）。中文回退苹方
        sans: [
          'DM Sans',
          '-apple-system',
          'BlinkMacSystemFont',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif',
        ],
        // 标题/数字/标签：Nunito 的圆润终端正是黏土风的语气
        display: [
          'Nunito',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif',
        ],
        // 保留命名但不再下载字体：黏土风不用等宽，标签改 Nunito 大写 + 字距
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      borderRadius: {
        // 覆盖 Tailwind 默认档位 → 黏土世界的"超级圆角"（永远 ≥14px）
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        '3xl': 'var(--r-3xl)',
        // 语义化别名，新代码用这组更清楚
        clay: 'var(--r-lg)',
        'clay-lg': 'var(--r-xl)',
        'clay-xl': 'var(--r-2xl)',
      },

      boxShadow: {
        // 覆盖 Tailwind 默认档位：默认阴影是"黑色硬投影"，与黏土材质冲突
        sm: '0 4px 10px rgb(160 150 180 / 0.18), -2px -2px 8px rgb(255 255 255 / 0.7)',
        md: '10px 10px 24px rgb(160 150 180 / 0.2), -6px -6px 16px rgb(255 255 255 / 0.85)',
        lg: '16px 16px 32px rgb(160 150 180 / 0.22), -10px -10px 24px rgb(255 255 255 / 0.9)',
        xl: 'var(--sh-card)',
        '2xl': 'var(--sh-clay)',
        // ---- 黏土材质（四层堆叠：外投影 + 高光 + 内反弹 + 内边缘光）----
        clay: 'var(--sh-clay)',
        clayCard: 'var(--sh-card)',
        clayCardHover: 'var(--sh-card-hover)',
        clayButton: 'var(--sh-button)',
        clayButtonHover: 'var(--sh-button-hover)',
        clayPressed: 'var(--sh-pressed)',
        clayPressedSm: 'var(--sh-pressed-sm)',
        claySoft: 'var(--sh-soft)',
        clayOrb: 'var(--sh-orb)',
        glow: 'var(--sh-glow)',
      },

      transitionTimingFunction: {
        /** 入场用：自信、略带回弹 */
        bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        swift: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' },
        },
        // ---- 零重力漂浮：背景光斑与装饰元素 ----
        'clay-float': {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(2deg)' },
        },
        'clay-float-delayed': {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-15px) rotate(-2deg)' },
        },
        'clay-float-slow': {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-30px) rotate(5deg)' },
        },
        // ---- 呼吸：统计球轻微的"充气/放气" ----
        'clay-breathe': {
          '0%,100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        // 小圆点的呼吸指示（幅度刻意做小，只在徽章里用）
        'pulse-soft': {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.35)', opacity: '0.55' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'drawer-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        // Toast：从右侧"弹"进来
        'pop-in': {
          from: { opacity: '0', transform: 'translateX(24px) scale(0.92)' },
          to: { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'lift-in': {
          from: { opacity: '0', transform: 'translateY(-12px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },

      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'caret-blink': 'caret-blink 1.25s ease-out infinite',
        'clay-float': 'clay-float 8s ease-in-out infinite',
        'clay-float-delayed': 'clay-float-delayed 10s ease-in-out infinite',
        'clay-float-slow': 'clay-float-slow 12s ease-in-out infinite',
        'clay-breathe': 'clay-breathe 6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out both',
        'drawer-in': 'drawer-in 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        'pop-in': 'pop-in 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both',
        'lift-in': 'lift-in 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
