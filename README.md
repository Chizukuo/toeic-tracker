# Cheese TOEIC Tracker

> **"Sprint to Mastery."** 
> 纯本地、高颜值的 TOEIC 冲刺训练看板。全流程闭环集成计时、复盘、生词、估分与数据同步，支持自定义冲刺目标（5~20套题），精准适配每一个备考周期。

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com)

---

## 核心设计理念

传统的 TOEIC 备考往往在题库中迷失，而 **Cheese TOEIC Command Deck** 专注于**流程管理**与**深度反馈**：

- **自定义冲刺引擎**：摒弃死板的固定周期，支持 5 / 10 / 15 / 20 套题动态重构，完美兼容短期突击与长线作战。
- **线性冲刺流**：将计时、对分、错题归因整合成无缝的单向工作流，彻底消除决策损耗。
- **Widget 化沉浸看板**：参考台与备份中心均采用 Apple-inspired 的悬浮卡片式 UI 架构，信息呈现从容、美观，化解备考焦虑。
- **生词记忆仓库**：不再只是记录，通过自动词典查阅、例句提取与重复频率追踪，构建高频考点词库。
- **PEASEA 估分体系**：基于非线性插值与异常响应惩罚，提供比传统换算表更具颗粒度的成绩预测。
- **隐私与自由**：数据 100% 存在本地，不收集隐私，不依赖服务端，随时生成快照或一键扫码转端同步。

## 模块介绍

| 模块 | 核心功能 |
| :--- | :--- |
| **Mission Control** | 首页仪表盘。考试倒计时、下一步行动建议、最近成就、活动热力图。 |
| **Sprint Flow** | **计时 -> 复盘 -> 结果** 三位一体。支持阅读分段计时（Waterfall Chart）与严格听力限时。 |
| **Vocab Vault** | 自动查词（英汉双语）、语音朗读、例句提取。追踪“重复栽跟头”的顽固生词。 |
| **Insights & Analytics** | PEASEA 估分模型、CEFR 等级预测、错因分布雷达、分段耗时偏差分析。 |
| **What-if Simulator** | 分数实验台。模拟不同正确率下的得分走向，提前感知提分路径。 |
| **Engagement** | 游戏化激励。勋章系统（Achievements）、周报总结、练习活跃热力图。 |
| **Data Vault** | JSON 高版本快照导出、极简压缩同步链接、二维码跨端传输。 |

## 页面路由

```
/              Mission Control — 总览仪表盘、动态练习网格、倒计时
/plan          Sprint Plan — 自定义周期练习长廊与状态切换
/practice      Sprint Flow — **核心入口**。集成计时、录入与复盘
/vocab         Vocab Vault — 生词本，支持查词与记忆追踪
/insights      Deep Analytics — 诊断、预测（PEASEA）、行动建议
/vault         Data Management — 快照备份、链接同步、系统重置
```

## 推荐工作流

我们的设计鼓励一种 **“专注 -> 诊断 -> 固化”** 的循环：

1. **Plan**：在 `/plan` 选择当前的练习节点（如 R3 或 L5）。
2. **Practice**：进入 `/practice` 启动计时。阅读时手动点击 Lap 记录各 Part 用时。
3. **Review**：倒计时结束（或主动提交）后，直接原地录入错题数与错因标签。
4. **Log Vocab**：复盘时遇到的生词，顺手在 `/vocab` 或 practice 侧边栏录入，系统自动抓取释义。
5. **Analyze**：在 `/insights` 查看本次练习后的分数波动与弱项变化。
6. **Sync**：周期性在 `/vault` 生成同步链接，备份到移动端或备忘录。

## 技术栈

| 层级 | 关键选型 |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router) · React 19 · TypeScript |
| **UX/UI** | Tailwind CSS 4 · Framer Motion · Lucide Icons · Radix UI |
| **State** | Zustand (with Storage Persistence) |
| **Data Viz** | Recharts · SVG Heatmaps |
| **Algorithm** | PEASEA Scorer (Linear Interpolation + Anomaly Penalty) |
| **Sync** | fflate (zlib) · base64url compression |

## 快速开始

### 环境依赖

- Node.js 20+
- npm 10+

### 本地运行

```bash
git clone https://github.com/Chizukuo/toeic-tracker.git
cd toeic-tracker
npm install
npm run dev
```

访问 `http://localhost:3000` 即可开启你的冲刺。

## 可用脚本

- `npm run dev`: 开发模式，支持 HMR。
- `npm run build`: 生产构建，产物静态导出至 `out/` 目录。
- `npm run test`: 运行 Vitest 单元测试（核心逻辑、同步、估分）。
- `npm run lint`: ESLint 代码质量检查。

## 环境变量

| 变量名 | 默认值 | 用途 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | `https://toeic.chizunet.cc` | 用于生成 canonical 链接、OG 图片地址与 sitemap |

## 部署说明

本项目采用 **SSG (Static Site Generation)** 模式，不依赖任何服务端运行时。

- **Cloudflare Pages**: 推荐方案。设置构建命令为 `npm run build`，输出目录为 `out`。
- **GitHub Pages / Vercel**: 同样支持，确保启用静态导出模式即可。

## 已知边界

- **个人工具定位**：本项目专注于个人冲刺提分，不提供公共账号系统或联网题库。
- **数据安全**：由于数据仅存储在浏览器 localStorage，请务必养成在 `/vault` 导出备份的习惯。
- **估分参考**：PEASEA 模型是基于历史趋势的拟合，仅供备考心态调节，不作为官方成绩保证。

## License

[MIT](LICENSE) &copy; 2026 chizukuo
