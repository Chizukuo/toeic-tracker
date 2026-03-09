'use client';

import type { ReactNode } from 'react';
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import { ClipboardList, Orbit, TimerReset } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCopy } from '@/lib/i18n';
import { useStore } from '@/store/useStore';

type UnfinishedPoint = {
	id: string;
	label: string;
	count: number;
	active: boolean;
	hasBacklog: boolean;
	tag: string;
};

export function UnfinishedTrackerPanel() {
	const { sessions, activeSessionId, locale, selectSession } = useStore();
	const copy = getCopy(locale);

	const chartData: UnfinishedPoint[] = sessions.map((session) => ({
		id: session.id,
		label: session.label,
		count: session.timerSummary?.unfinishedQuestions ?? 0,
		active: session.id === activeSessionId,
		hasBacklog: (session.timerSummary?.unfinishedQuestions ?? 0) > 0,
		tag: session.timerSummary?.timedOut
			? locale === 'zh'
				? '超时'
				: 'Timeout'
			: session.timerSummary?.forcedSubmit
				? locale === 'zh'
					? '强制交卷'
					: 'Forced'
				: locale === 'zh'
					? '正常交卷'
					: 'Saved',
	}));

	const unfinishedSessions = chartData.filter((session) => session.hasBacklog);
	const totalUnfinished = unfinishedSessions.reduce((sum, session) => sum + session.count, 0);
	const currentUnfinished = chartData.find((session) => session.id === activeSessionId)?.count ?? 0;
	const latestUnfinished = [...sessions]
		.filter((session) => (session.timerSummary?.unfinishedQuestions ?? 0) > 0)
		.sort(
			(a, b) =>
				new Date(b.timerSummary?.completedAt ?? 0).getTime() -
				new Date(a.timerSummary?.completedAt ?? 0).getTime()
		)[0];

	return (
		<Card className="glass-panel overflow-hidden rounded-[28px] border-zinc-200/70 shadow-sm dark:border-zinc-800">
			<CardHeader className="border-b border-zinc-100 bg-zinc-50/70 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950/60">
				<CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
					{copy.unfinishedTrackerTitle}
				</CardTitle>
				<CardDescription className="max-w-3xl text-xs leading-6">
					{copy.unfinishedTrackerDescription}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 p-6 xl:grid-cols-[320px_minmax(0,1fr)]">
				<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
					<TrackerStat
						icon={<ClipboardList className="size-4" />}
						label={copy.unfinishedTotal}
						value={`${totalUnfinished}`}
						helper={copy.unfinishedChartHint}
					/>
					<TrackerStat
						icon={<Orbit className="size-4" />}
						label={copy.unfinishedSessions}
						value={`${unfinishedSessions.length}`}
						helper={copy.affectedCount(unfinishedSessions.length)}
					/>
					<TrackerStat
						icon={<TimerReset className="size-4" />}
						label={copy.unfinishedCurrent}
						value={`${currentUnfinished}`}
						helper={latestUnfinished ? `${copy.unfinishedLatest}: ${latestUnfinished.label}` : copy.unfinishedNone}
						warning={currentUnfinished > 0}
					/>
				</div>

				<div className="rounded-[24px] border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 pb-3 dark:border-zinc-800">
						<div>
							<div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
								{copy.unfinishedQueue}
							</div>
							<div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
								{copy.unfinishedChartHint}
							</div>
						</div>
						<div className="rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
							{copy.unfinished(totalUnfinished)}
						</div>
					</div>

					{unfinishedSessions.length === 0 ? (
						<div className="flex min-h-48 flex-col items-center justify-center rounded-[20px] border border-dashed border-zinc-200/80 bg-white/75 px-6 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/70">
							<div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
								<ClipboardList className="size-5" />
							</div>
							<div className="mt-4 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
								{copy.unfinishedNone}
							</div>
							<p className="mt-2 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
								{copy.unfinishedNoneDescription}
							</p>
						</div>
					) : (
						<>
							<div className="mt-4 h-72">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="rgba(161,161,170,0.15)" vertical={false} />
										<XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" />
										<YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#71717a" allowDecimals={false} />
										<Tooltip
											cursor={{ stroke: 'rgba(245,158,11,0.24)', strokeWidth: 1 }}
											contentStyle={{
												background: 'var(--tooltip-bg)',
												borderColor: 'var(--tooltip-border)',
												borderRadius: '12px',
												fontSize: '12px',
												color: 'var(--tooltip-color)',
											}}
											formatter={(value: number, _name, item) => [
												copy.unfinished(Number(value)),
												item?.payload?.tag ?? copy.unfinishedTrackerTitle,
											]}
										/>
										<Line
											type="monotone"
											dataKey="count"
											stroke="#f59e0b"
											strokeWidth={2.5}
											dot={(props) => {
												const { cx, cy, payload } = props;

												if (cx === undefined || cy === undefined || !payload) {
													return <g />;
												}

												return (
													<circle
														cx={cx}
														cy={cy}
														r={payload.active ? 6 : payload.hasBacklog ? 4.5 : 3}
														fill={payload.hasBacklog ? '#ef4444' : '#f59e0b'}
														stroke={payload.active ? '#111827' : '#fff'}
														strokeWidth={payload.active ? 2 : 1.5}
														className={payload.hasBacklog ? 'cursor-pointer' : 'cursor-default'}
														onClick={() => selectSession(payload.id)}
													/>
												);
											}}
											activeDot={{ r: 7, fill: '#111827', stroke: '#f59e0b', strokeWidth: 2 }}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>

							<div className="mt-4 flex flex-wrap gap-2">
								{unfinishedSessions.map((session) => (
									<Button
										key={session.id}
										variant={session.active ? 'default' : 'outline'}
										size="sm"
										onClick={() => selectSession(session.id)}
										className={session.active ? 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200' : 'font-mono text-[11px] tracking-[0.12em]'}
									>
										{session.label}
										<span className="ml-1.5 rounded-full bg-red-500/12 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-300">
											{session.count}
										</span>
									</Button>
								))}
							</div>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function TrackerStat({
	icon,
	label,
	value,
	helper,
	warning,
}: {
	icon: ReactNode;
	label: string;
	value: string;
	helper: string;
	warning?: boolean;
}) {
	return (
		<div className={`rounded-[22px] border p-4 ${warning ? 'border-red-500/30 bg-red-500/8' : 'border-zinc-200/70 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-900/50'}`}>
			<div className="flex items-center justify-between gap-3 text-zinc-500 dark:text-zinc-400">
				<div className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</div>
				<div className={warning ? 'text-red-500' : ''}>{icon}</div>
			</div>
			<div className={`mt-2 text-2xl font-semibold tracking-tight ${warning ? 'text-red-600 dark:text-red-400' : 'text-zinc-950 dark:text-zinc-50'}`}>
				{value}
			</div>
			<div className="mt-1 text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">{helper}</div>
		</div>
	);
}
