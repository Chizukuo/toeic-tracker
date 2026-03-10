# Cheese TOEIC Tracker

一个面向 TOEIC 20 天冲刺的可视化训练面板，帮助你把听力/阅读交替训练的数据集中管理：

- 严格计时（Listening 45m / Reading 75m）
- 分 Part 错题录入与错因标记
- 阅读分段配速记录（Part 5/6/7）
- 未完成题追踪与超时冻结提醒
- 估分面板与趋势图表
- 中英双语与明暗主题切换

## 项目截图定位

首页是一个单页控制台，核心区域包含：

- 冲刺总览（当前 session、完成率、高频错因、最弱 Part）
- 考试倒计时（可设置考试日期）
- 训练协议提示（计时规则/超时规则）
- 严格计时器 + Debug 数据录入
- 估分、趋势分析、未完成题瀑布和数据保险箱（导入/导出/重置）

## 技术栈

- Framework: Next.js 16 (App Router)
- UI: React 19 + Tailwind CSS 4 + shadcn/ui 组件
- State: Zustand（带持久化）
- Charts: Recharts
- Icons: Lucide React
- Language: TypeScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

浏览器打开：`http://localhost:3000`

### 3. 生产构建与预览

```bash
npm run build
npx serve out
```

构建完成后会生成静态目录 `out`。

### 4. 代码检查

```bash
npm run lint
```

## NPM Scripts

- `npm run dev`: 启动本地开发服务器
- `npm run build`: 生成静态导出（`out` 目录）
- `npm run lint`: 运行 ESLint

## 部署到 Cloudflare Pages

### 1. 连接仓库

- 在 Cloudflare Pages 选择 `Connect to Git`
- 选择仓库：`Chizukuo/toeic-tracker`
- 分支选择：`master`

### 2. 构建配置

- Framework preset: `None`
- Build command: `npm run build`
- Build output directory: `out`
- Root directory: `/`

### 3. 环境变量（推荐）

- `NODE_VERSION=20`

### 4. 部署

- 点击 `Save and Deploy`
- 首次成功后会得到 `*.pages.dev` 地址

## 部署说明

- 当前项目已配置 Next.js 静态导出（`output: 'export'`），适合 Cloudflare Pages。
- 若后续需要 Next.js SSR / API Routes，建议迁移到 Vercel 或 Cloudflare Workers 方案。

## 功能说明

### 1. 20 天 Session 模型

- 预置 20 个 session（L1-R1 到 L10-R10）
- 听力与阅读交替推进
- 每个 session 有独立状态：`not-started` / `in-progress` / `debugged`

### 2. 严格计时与提交

- Listening 固定 45 分钟
- Reading 固定 75 分钟，并支持分段打点（P5/P6/P7 Single/P7 Multiple）
- 超时会触发强制提交并要求填写未完成题数量

### 3. Debug 录入

- 按 Part 输入错题数
- 按题型选择错因标签
- 保存后将 session 标记为 `debugged`

### 4. 分析看板

- 错题趋势（听力/阅读）
- 薄弱项雷达
- 错因频次
- 未完成题队列与可视化
- 估分面板（听力、阅读、总分）

### 5. 数据保险箱（Data Vault）

- 导出当前训练快照为 JSON
- 从 JSON 导入快照
- 一键重置训练进度（保留语言和考试日期配置）

## 数据持久化

本项目使用 Zustand persist 在浏览器本地保存数据（`localStorage`）。

- 默认存储 key：`cheese-toeic-storage`
- 持久化内容：`sessions`、`activeSessionId`、`locale`、`examDate`

导出文件中包含：

- `app`
- `version`
- `exportedAt`
- `data.sessions`
- `data.activeSessionId`
- `data.locale`
- `data.examDate`

## 项目结构

```text
src/
	app/
		page.tsx                 # 主仪表盘页面
		layout.tsx
		globals.css
	components/
		LapTimer.tsx             # 严格计时与分段打点
		DebugForm.tsx            # 错题与错因录入
		AnalyticsDashboard.tsx   # 趋势/雷达/统计图
		ScoreEstimatorPanel.tsx  # 估分面板
		UnfinishedTrackerPanel.tsx
		TimeWaterfallChart.tsx
		SprintDashboard.tsx
		DataVaultPanel.tsx       # 导入/导出/重置
		LocaleToggle.tsx
		ThemeToggle.tsx
		ui/                      # 基础 UI 组件
	lib/
		toeic.ts                 # session 与计时/估分核心逻辑
		i18n.ts                  # 中英文文案与翻译
		utils.ts
	store/
		useStore.ts              # 全局状态与持久化
```

## 适合的使用方式

- 每天按当前 session 开始严格计时
- 完成后立即录入错题和错因
- 重点观察最弱 Part 与高频错因
- 每周导出一次快照做备份

## License

MIT，详见 `LICENSE`。
