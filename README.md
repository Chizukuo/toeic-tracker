# Cheese TOEIC Command Deck

> 纯本地、静态部署的 TOEIC 20 天冲刺训练看板 — 选题、计时、纠错、估分、同步，一站闭环。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)

---

## 为什么做这个

大多数 TOEIC 备考工具重在"题库"，但冲刺阶段真正需要的是**流程管理**：

- 只记做题结果远远不够，必须**严格计时**并对比分段趋势
- 错题和做不完的题要**分开诊断**，它们的提分路径完全不同
- 备考数据应该**属于你自己**，不依赖账号、不依赖后端

Cheese TOEIC Command Deck 围绕这三个痛点展开，把 20 天冲刺拆成清晰的 session 流，全部数据持久化在浏览器本地，随时可导出、可跨设备同步。

## 功能一览

| 模块 | 说明 |
| :--- | :--- |
| **Sprint Plan** | 20 天听力 + 阅读交替 session 规划，一键切换当前 session |
| **Strict Timer** | 全科严格倒计时（听力 45 min / 阅读 75 min）；阅读支持 Part 5/6/7 分段计时与瀑布图 |
| **Mistake Debug** | 8 Part × 8 错因标签（词汇、连读、口音、预判超时、语法误读、同义替换、交叉检索、长句解析） |
| **Unfinished Tracker** | 跟踪超时未完成题，与估分口径一致地计入失分 |
| **Analytics** | 错题趋势、失分堆叠图、Part 级弱点雷达图、压力指数排行 |
| **Score Estimator** | PEASEA 非线性估分 — 锚点插值 + 异常答题惩罚 + SEM 置信区间 + CEFR 等级映射 |
| **Data Vault** | JSON 快照导入导出、压缩同步链接 / 二维码（≤ 3200 字符）、全量重置 |
| **考试倒计时** | 首页可设置考试日期，实时显示剩余天数 |
| **双语界面** | 中 / 英运行时切换 |
| **暗色模式** | 跟随系统或手动切换，带 View Transitions 动画 |

## 页面路由

```
/              首页 — 总览仪表盘、下一步建议、倒计时
/plan          Sprint 规划 — session 列表与状态切换
/timer         计时器 — 严格倒计时、分段 Lap、错题录入
/unfinished    未完成追踪 — 堆积趋势与 session 队列
/analytics     分析看板 — 趋势图、弱点雷达、失分诊断
/scores        估分面板 — PEASEA 模型、分数趋势、CEFR 级别
/vault         数据保险库 — 导入 / 导出 / 同步链接 / 重置
```

## 推荐工作流

```
Plan ─▸ Timer ─▸ Unfinished ─▸ Analytics ─▸ Scores
  │                                             │
  └──── 每次做完一套就走一遍上面的流程 ────────────┘
  定期在 Vault 备份或同步到其他设备
```

1. `/plan` — 选择当天要做的 session
2. `/timer` — 开始严格计时（阅读可记录 Part 分段）
3. 计时结束后在同一页录入错题数与错因
4. `/unfinished` — 检查超时残留题是否持续堆积
5. `/analytics` — 定位薄弱 Part 与高频错因
6. `/scores` — 确认估分是否逐步抬升
7. `/vault` — 定期导出快照或生成同步链接

## 业务模型

### 训练节点

固定 20 个 session：`L1..L10`（听力）与 `R1..R10`（阅读），状态流转 `not-started → in-progress → debugged`。

### 估分与诊断

核心实现位于 `src/lib/toeic.ts`，输出包含单科分、总分、置信区间、CEFR 级别、强弱项与异常模式诊断。阅读未完成题会并入 Part 级失分向量参与分析。

### 本地优先数据模型

训练数据仅保存在浏览器 `localStorage`（Zustand persist key: `cheese-toeic-storage`），跨设备同步通过压缩链接和快照文件完成，不引入账户系统。

## 技术栈

| 层 | 选型 |
| :--- | :--- |
| 框架 | Next.js 16 App Router · React 19 · TypeScript |
| 样式 | Tailwind CSS 4 · shadcn/ui · Lucide Icons |
| 状态 | Zustand（localStorage persist） |
| 图表 | Recharts |
| 数据同步 | fflate (zlib) · base64url 压缩编码 |
| 测试 | Vitest |
| 部署 | 静态导出（`output: 'export'`）→ Cloudflare Pages |

## 架构要点

- **路由层 / 交互层分离** — 路由入口 `page.tsx` 导出 metadata，交互逻辑放在同目录 `*PageClient.tsx`
- **静态导出优先** — 无服务端 API / 数据库依赖，适配 Cloudflare Pages / GitHub Pages 等静态托管
- **SEO 与社交分享** — OG / Twitter 卡片路由、JSON-LD 结构化数据、`NEXT_PUBLIC_SITE_URL` 可覆盖站点地址

## 快速开始

### 运行要求

- Node.js 20+
- npm 10+

```bash
git clone https://github.com/Chizukuo/toeic-tracker.git
cd toeic-tracker
npm install
npm run dev
```

打开 `http://localhost:3000` 即可使用。

## 可用脚本

| 命令 | 说明 |
| :--- | :--- |
| `npm run dev` | 开发模式（HMR） |
| `npm run build` | 生产构建 — 静态导出到 `out/` |
| `npm run start` | Next.js 生产服务模式 |
| `npm run test` | Vitest 单元测试 |
| `npm run lint` | ESLint 检查 |

## 环境变量

本项目当前只有 1 个环境变量：

| 变量名 | 是否必需 | 默认行为 | 用途 |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | 否 | 未设置或格式非法时回退到 `https://toeic-tracker.pages.dev` | 生成 canonical、sitemap、OG/Twitter 分享链接时的站点基地址 |

### 本地开发示例

在项目根目录新建 `.env.local`：

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 生产环境示例

- Cloudflare Pages / Vercel / Netlify 中将 `NEXT_PUBLIC_SITE_URL` 设置为线上域名
- 推荐使用完整 `https` 地址，例如：

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## 测试

```bash
npm run test
```

覆盖的核心模块：

- `src/lib/toeic.test.ts` — 估分模型与未完成题分配
- `src/lib/nextStep.test.ts` — 下一步建议逻辑
- `src/lib/syncLink.test.ts` — 同步链接编解码与兼容性
- `src/store/useStore.test.ts` — 状态管理与快照导入

## 部署

项目采用纯静态导出，构建产物位于 `out/`，可直接托管到任何静态服务。

```bash
npm run build
# 将 out/ 部署到 Cloudflare Pages / Vercel / Netlify / GitHub Pages
```

**Cloudflare Pages 示例配置：** Build command `npm run build`，输出目录 `out`，Node 20+，建议设置 `NEXT_PUBLIC_SITE_URL` 环境变量。

## 项目结构

```
src/
├── app/                  # Next.js App Router 页面
│   ├── page.tsx          # 首页（metadata + 客户端仪表盘）
│   ├── plan/             # Sprint 规划
│   ├── timer/            # 严格计时器
│   ├── unfinished/       # 未完成题跟踪
│   ├── analytics/        # 分析看板
│   ├── scores/           # 估分面板
│   └── vault/            # 数据保险库
├── components/           # UI 组件
│   ├── ui/               # shadcn/ui 基础组件
│   └── *.tsx             # 业务面板
├── lib/                  # 纯函数与工具
│   ├── toeic.ts          # PEASEA 估分模型
│   ├── syncLink.ts       # 压缩同步编解码
│   ├── nextStep.ts       # 下一步建议
│   ├── i18n.ts           # 中英双语字典
│   └── seo.ts            # SEO 工具
└── store/
    └── useStore.ts       # Zustand 全局状态
```

## 已知边界

- 这是训练期工作台，不是官方 TOEIC 成绩换算器
- 数据默认只存在本地浏览器，清缓存前应主动导出备份
- 若未来需要登录、云同步或多人协作，当前静态导出架构需要调整

## License

[MIT](LICENSE) &copy; 2026 chizukuo
