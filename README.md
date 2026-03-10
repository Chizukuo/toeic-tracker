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

### 5. PEASEA 估分算法说明

PEASEA 是这个项目里的经验型估分引擎，用来把单次 session 的错题分布、阅读未完成题和异常答题模式，映射为更接近真实 TOEIC 观感的分数区间。它不是官方换算表，也不试图复刻 ETS 的打分细节；它的目标是让训练阶段的“趋势判断”比简单扣分法更稳。

#### 5.1 输入向量

算法始终从 8 维 Part 失分向量开始：

- Listening: Part 1、Part 2、Part 3、Part 4
- Reading: Part 5、Part 6、Part 7 Single、Part 7 Multiple

每个维度记录该 Part 的失分数量，而不是只看整套总错题。这样做的原因是 TOEIC 不同 Part 的难度、题量和时间压力不同，单看总错题会把很多结构性问题抹平。

#### 5.2 阅读未完成题并入失分

阅读部分的未完成题不会被单独悬空保存，而是直接并入 Part 级失分向量，分配顺序为：

1. Part 7 Multiple
2. Part 7 Single
3. Part 6
4. Part 5

这代表一种现实假设：真正因为时间崩盘而没做完的题，通常先堆积在后段长篇阅读。这样处理后，趋势图、雷达图和估分面板会使用同一套失分口径。

#### 5.3 原始正确题数

对单科来说：

- 总题量固定为 100
- 原始正确题数 = 100 - Part 失分总和
- 结果会被限制在 0 到 100 之间

这一步得到的是最基础的 raw correct，但 PEASEA 不会直接把它线性换成标准分。

#### 5.4 异常答题模式惩罚

算法会把题目分成“基础层”和“高阶层”，再比较两层错误率差异：

- Listening 基础层：Part 1、Part 2
- Listening 高阶层：Part 3、Part 4
- Reading 基础层：Part 5
- Reading 高阶层：Part 6、Part 7 Single、Part 7 Multiple

如果出现“基础层错很多，但高阶层错误率反而更低”的异常分布，系统会认为这份答题模式不够稳定，于是对原始正确题数施加惩罚。代码里的核心逻辑可以概括为：

```text
deltaRaw = alpha * min(0, advancedErrorRate - basicErrorRate) * 100
adjustedRawCorrect = clamp(rawCorrect + deltaRaw, 0, 100)
```

其中：

- Listening 的 alpha = 0.12
- Reading 的 alpha = 0.18
- 当高阶层错误率高于基础层时，不额外奖励，只是不触发惩罚
- 当基础层明显更差时，adjusted raw 会低于 raw correct

这种处理避免了一个常见问题：只看总对题数时，某些“基础题漏得很多、难题反而蒙对不少”的记录会被高估。

#### 5.5 非线性锚点插值

adjusted raw 仍然不会直接按比例映射到 5-495 分，而是进入分段锚点插值。Listening 和 Reading 各自有一套锚点矩阵，例如：

- Listening: 60 raw 对应 295，80 raw 对应 420，95 raw 对应 495
- Reading: 60 raw 对应 250，80 raw 对应 360，95 raw 对应 470

算法会在相邻锚点之间做线性插值，再把结果四舍五入到最接近的 5 分。这样得到的曲线是非线性的，能体现 TOEIC 原始题数和标准分之间并不均匀的换算关系。

#### 5.6 总分、区间与等级

当听力和阅读都可用时：

- 总分 = 听力标准分 + 阅读标准分
- 单科 SEM 固定为 25
- 总分 SEM 按两科平方和开根后再四舍五入到 5 分档
- 最终输出区间为 score ± SEM

同时系统会给出 CEFR 级别：

- A1 / A2 / B1 / B2 / C1
- 若未达到最低阈值，则显示 Below A1

#### 5.7 诊断输出

除了分数本身，PEASEA 还会生成诊断型信息：

- weakestPart / strongestPart
- unfinishedPenalty
- responsePattern（normal 或 aberrant）
- 各 Part error rate 与 share of loss

这也是为什么估分面板和分析看板会同时展示趋势、雷达图和分项诊断，而不是只给一个总分数字。

#### 5.8 与官方成绩的关系

PEASEA 适合做下面这些事情：

- 观察自己在 20 天冲刺中的趋势变化
- 比较不同 session 的结构性差异
- 识别“时间问题”还是“能力问题”在拖分

它不适合被当成官方查分前的精确替代，因为真实 TOEIC 成绩还会受题本难度、等值处理和官方量尺影响。

## Cloudflare Pages 部署

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

### 5. PEASEA 估分算法说明

- 核心实现位于 `src/lib/toeic.ts`。
- 详细流程见上方“PEASEA 估分算法说明”章节。
- 分析看板中的雷达图、趋势图和估分面板共用同一套 Part 级失分口径。

### 6. 数据保险箱（Data Vault）

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
