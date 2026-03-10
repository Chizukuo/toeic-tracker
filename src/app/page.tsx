'use client';

import Link from 'next/link';
import { ArrowRight, ChartNoAxesColumn, Clock3, Database, LayoutDashboard, ListChecks, Route } from 'lucide-react';

import { DashboardShell, SectionShell, useDashboardContext } from '@/components/DashboardShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function Home() {
  return (
    <DashboardShell>
      <HomeOverview />
    </DashboardShell>
  );
}

function HomeOverview() {
  const { locale, copy, activeSession } = useDashboardContext();

  const routes = [
    {
      href: '/plan',
      title: copy.dashboardTitle,
      description: locale === 'zh' ? '切换 session，查看 20 天冲刺全局排布。' : 'Switch sessions and inspect the full sprint layout.',
      icon: Route,
      accent: 'amber' as const,
    },
    {
      href: '/timer',
      title: locale === 'zh' ? '计时与录入' : 'Timer & Review',
      description: locale === 'zh' ? '进入当前套题的计时、瀑布图和复盘录入。' : 'Open the active timer, waterfall, and review form.',
      icon: Clock3,
      accent: 'cyan' as const,
    },
    {
      href: '/unfinished',
      title: copy.unfinishedTrackerTitle,
      description: locale === 'zh' ? '集中查看超时后未完成题与影响范围。' : 'Track leftover questions from timed runs.',
      icon: ListChecks,
      accent: 'coral' as const,
    },
    {
      href: '/analytics',
      title: copy.analyticsTitle,
      description: locale === 'zh' ? '集中查看趋势、短板和高频错因。' : 'Review trends, weak spots, and root causes in one place.',
      icon: ChartNoAxesColumn,
      accent: 'slate' as const,
    },
    {
      href: '/scores',
      title: copy.scoreEstimatorTitle,
      description: locale === 'zh' ? '独立查看听力、阅读与总分估算。' : 'Inspect listening, reading, and total estimates.',
      icon: LayoutDashboard,
      accent: 'amber' as const,
    },
    {
      href: '/vault',
      title: copy.dataVaultTitle,
      description: locale === 'zh' ? '备份、恢复和重置本地数据。' : 'Backup, restore, or reset local data.',
      icon: Database,
      accent: 'cyan' as const,
    },
  ];

  return (
    <>
      <SectionShell
        index="01"
        title={locale === 'zh' ? '工作区导航' : 'Workspace Navigation'}
        description={locale === 'zh' ? '首页只保留总览和入口，具体操作进入对应页面。' : 'Overview stays here; detailed workflows live on dedicated pages.'}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {routes.map((item) => (
            <Link key={item.href} href={item.href} className="group">
              <Card className="glass-panel h-full rounded-[30px] border border-white/65 transition-transform duration-200 group-hover:-translate-y-1 dark:border-white/10">
                <CardHeader className="px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={cn(
                        'flex size-12 items-center justify-center rounded-2xl shadow-[0_18px_34px_-18px_rgba(15,23,42,0.35)]',
                        item.accent === 'amber'
                          ? 'bg-[linear-gradient(135deg,#ffd36d_0%,#ff9a5c_100%)]'
                          : item.accent === 'coral'
                            ? 'bg-[linear-gradient(135deg,#ffb091_0%,#ef7154_100%)]'
                            : item.accent === 'slate'
                              ? 'bg-[linear-gradient(135deg,#e4e4e7_0%,#71717a_100%)] text-white'
                              : 'bg-[linear-gradient(135deg,#98ecff_0%,#54d4ff_100%)]'
                      )}
                    >
                      <item.icon className="size-5 text-zinc-950" />
                    </div>
                    <ArrowRight className="mt-1 size-4 text-zinc-400 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                  <CardTitle className="pt-4 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                    {item.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        index="02"
        title={locale === 'zh' ? '当前套题入口' : 'Current Set'}
        description={locale === 'zh' ? '当前活跃 session 可以直接跳转到计时与复盘页。' : 'Jump directly into the active timer and review flow.'}
      >
        <Card className="glass-panel overflow-hidden rounded-[32px] border border-white/65 dark:border-white/10">
          <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
                {locale === 'zh' ? 'Active Session' : 'Active Session'}
              </div>
              <div className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                {activeSession.label}
              </div>
              <div className="mt-2 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
                {locale === 'zh'
                  ? `${activeSession.type === 'L' ? '听力' : '阅读'}第 ${activeSession.setNumber} 套，直接进入操作页继续。`
                  : `${activeSession.title}. Continue from the dedicated workflow page.`}
              </div>
            </div>

            <Link
              href="/timer"
              className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.22em] text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {locale === 'zh' ? '打开计时页' : 'Open Timer Page'}
            </Link>
          </CardContent>
        </Card>
      </SectionShell>
    </>
  );
}