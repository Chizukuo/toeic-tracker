# Cheese TOEIC Tracker

TOEIC 20 天冲刺训练管理系统，集成化追踪听力与阅读交替训练的全周期数据。

## 核心功能

- **严格计时模式** - Listening 45min / Reading 75min 标准计时
- **错题分析系统** - 分 Part 错题统计与错因分类标记
- **阅读配速监控** - Part 5/6/7 分段计时与节奏分析
- **未完成题追踪** - 超时题目自动记录与可视化展示
- **估分与趋势分析** - 实时估分面板与多维度趋势图表
- **多语言与主题** - 中英文切换 / 明暗主题适配

## 功能概览

单页面集成式控制台，包含以下功能模块：

- **冲刺仪表盘** - 当前 Session 进度、完成率统计、高频错因分析、薄弱 Part 识别
- **考试倒计时** - 自定义考试日期与倒计时显示
- **训练协议说明** - 计时规则与超时处理机制
- **计时与录入系统** - 严格计时器 + Debug 数据录入表单
- **数据分析模块** - 估分面板、趋势图表、未完成题瀑布图、数据导入导出

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
- `NEXT_PUBLIC_SITE_URL=https://你的正式域名`（用于 canonical、sitemap、Open Graph 等 SEO 地址生成）

### 4. 部署

- 点击 `Save and Deploy`
- 首次成功后会得到 `*.pages.dev` 地址

## 部署说明

- 当前项目已配置 Next.js 静态导出（`output: 'export'`），适合 Cloudflare Pages。
- 若后续需要 Next.js SSR / API Routes，建议迁移到 Vercel 或 Cloudflare Workers 方案。

## 功能说明

### 1. 20 天 Session 模型

- 预设 20 个训练单元（L1-R1 至 L10-R10）
- 听力与阅读交替推进模式
- 状态追踪：`not-started` → `in-progress` → `debugged`

### 2. 严格计时与提交

- Listening 模式：固定 45 分钟
- Reading 模式：固定 75 分钟，支持分段打点（P5/P6/P7 Single/P7 Multiple）
- 超时自动提交并触发未完成题数量录入

### 3. Debug 录入

- 分 Part 错题数量统计
- 错因标签分类标记
- 自动更新 Session 状态为 `debugged`

### 4. 分析看板

- 错题趋势图（听力/阅读分离）
- 薄弱项雷达分析
- 错因频次统计
- 未完成题队列可视化
- 三维估分面板（听力/阅读/总分）

### 5. 数据保险箱（Data Vault）

- JSON 格式快照导出
- 快照导入与恢复
- 一键重置训练数据（保留语言与考试日期设置）

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

## 推荐工作流

1. **练习阶段** - 按当前 Session 启动严格计时模式
2. **数据录入** - 完成后立即录入错题数量与错因分类
3. **数据分析** - 定期查看薄弱 Part 识别与高频错因统计
4. **数据备份** - 每周执行一次 JSON 快照导出

## License

MIT，详见 `LICENSE`。
