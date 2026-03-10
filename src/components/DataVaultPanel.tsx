'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Database, Download, RotateCcw, ShieldAlert, Upload } from 'lucide-react';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCopy } from '@/lib/i18n';
import type { ImportSnapshotResult } from '@/store/useStore';
import { useStore } from '@/store/useStore';

type FeedbackTone = 'success' | 'error' | 'info';

export function DataVaultPanel() {
	const locale = useStore((state) => state.locale);
	const copy = getCopy(locale);
	const sessions = useStore((state) => state.sessions);
	const activeSessionId = useStore((state) => state.activeSessionId);
	const examDate = useStore((state) => state.examDate);
	const historicalScores = useStore((state) => state.historicalScores);
	const exportSnapshot = useStore((state) => state.exportSnapshot);
	const importSnapshot = useStore((state) => state.importSnapshot);
	const resetProgress = useStore((state) => state.resetProgress);

	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [feedback, setFeedback] = useState<{ tone: FeedbackTone; text: string } | null>(null);
	const [resetOpen, setResetOpen] = useState(false);

	const recordedSessions = sessions.filter((session) => session.status !== 'not-started').length;
	const reviewedSessions = sessions.filter((session) => session.status === 'debugged').length;
	const activeSessionLabel = sessions.find((session) => session.id === activeSessionId)?.label ?? activeSessionId;

	const handleExport = () => {
		try {
			const snapshot = exportSnapshot();
			const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			const date = snapshot.exportedAt.slice(0, 10);

			anchor.href = url;
			anchor.download = `cheese-toeic-tracker-v${snapshot.version}-${date}.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);

			setFeedback({ tone: 'success', text: `${copy.exportSuccess} v${snapshot.version}` });
		} catch {
			setFeedback({ tone: 'error', text: copy.exportFailure });
		}
	};

	const handleImportClick = () => {
		fileInputRef.current?.click();
	};

	const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];

		if (!file) {
			return;
		}

		try {
			const rawText = await file.text();
			const parsed = JSON.parse(rawText) as unknown;
			const result = importSnapshot(parsed);
			setFeedback({ tone: 'success', text: formatImportFeedback(locale, copy.importSuccess, result) });
		} catch (error) {
			setFeedback({
				tone: 'error',
				text: error instanceof Error && error.message ? `${copy.importFailure} ${error.message}` : copy.importFailure,
			});
		} finally {
			event.target.value = '';
		}
	};

	const handleReset = () => {
		resetProgress();
		setResetOpen(false);
		setFeedback({ tone: 'info', text: copy.resetSuccess });
	};

	return (
		<>
			<Card className="deck-card">
				<CardHeader className="deck-card-header px-6 py-5">
					<CardTitle className="font-mono text-[11px] uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
						{copy.dataVaultTitle}
					</CardTitle>
					<CardDescription className="max-w-3xl text-xs leading-6">
						{copy.dataVaultDescription}
					</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4 p-6 xl:grid-cols-3">
					<div className="xl:col-span-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<SummaryTile
							label={locale === 'zh' ? '已录入套题' : 'Recorded Sets'}
							value={`${recordedSessions}/20`}
							helper={locale === 'zh' ? '已保存计时或复盘数据' : 'Sets with saved timer or review data'}
						/>
						<SummaryTile
							label={locale === 'zh' ? '已完成复盘' : 'Reviewed'}
							value={`${reviewedSessions}/20`}
							helper={locale === 'zh' ? '已标记 debugged 的节点' : 'Sessions marked as reviewed'}
						/>
						<SummaryTile
							label={locale === 'zh' ? '历史成绩' : 'History Records'}
							value={`${historicalScores.length}`}
							helper={locale === 'zh' ? '手动录入与估分记录' : 'Manual and estimated score entries'}
						/>
						<SummaryTile
							label={locale === 'zh' ? '当前定位' : 'Active Session'}
							value={activeSessionLabel}
							helper={examDate}
						/>
					</div>

					<ActionPanel
						icon={<Download className="size-5" />}
						title={copy.exportTitle}
						body={copy.exportBody}
						actionLabel={copy.exportAction}
						onAction={handleExport}
					/>
					<ActionPanel
						icon={<Upload className="size-5" />}
						title={copy.importTitle}
						body={copy.importBody}
						actionLabel={copy.importAction}
						onAction={handleImportClick}
					/>
					<ActionPanel
						icon={<RotateCcw className="size-5" />}
						title={copy.resetTitle}
						body={copy.resetBody}
						actionLabel={copy.resetAction}
						onAction={() => setResetOpen(true)}
						danger
					/>

					<div className="xl:col-span-3 grid gap-4 xl:grid-cols-[2fr_1fr]">
						<div className="deck-surface-soft flex flex-col justify-center p-5">
							<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
								<Database className="size-3.5" />
								{copy.dataVaultNotes}
							</div>
							<div className="mt-4 flex flex-col gap-2 text-[13px] leading-5 text-zinc-600 dark:text-zinc-300">
								<p>{copy.dataVaultNoteExport}</p>
								<p>{copy.dataVaultNoteImport}</p>
								<p>{copy.dataVaultNoteReset}</p>
							</div>
						</div>

						<div className="deck-surface-strong flex flex-col p-5">
							<div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
								{copy.lastOperation}
							</div>
							<div className={`mt-4 flex flex-1 items-center rounded-xl border px-4 py-3 text-sm leading-tight ${feedbackClassName(feedback?.tone)}`}>
								{feedback?.text ?? copy.dataVaultIdle}
							</div>
						</div>
					</div>

					<Input
						ref={fileInputRef}
						type="file"
						accept="application/json,.json"
						className="hidden"
						onChange={handleImportFile}
					/>
				</CardContent>
			</Card>

			<Dialog open={resetOpen} onOpenChange={setResetOpen}>
				<DialogContent showCloseButton={false} className="deck-card max-w-lg border border-white/65 bg-white/92 p-0 dark:border-white/10 dark:bg-zinc-950/92">
					<DialogHeader className="px-6 pt-6">
						<div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
							<ShieldAlert className="size-5" />
						</div>
						<DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
							{copy.resetDialogTitle}
						</DialogTitle>
						<DialogDescription className="text-sm leading-7">
							{copy.resetDialogBody}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="rounded-b-[28px] border-white/60 bg-white/70 dark:border-white/8 dark:bg-white/[0.04]">
						<Button variant="outline" onClick={() => setResetOpen(false)}>
							{copy.cancelAction}
						</Button>
						<Button variant="destructive" onClick={handleReset}>
							{copy.confirmResetAction}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

function SummaryTile({
	label,
	value,
	helper,
}: {
	label: string;
	value: string;
	helper: string;
}) {
	return (
		<div className="deck-surface-soft rounded-[22px] p-4">
			<div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</div>
			<div className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">{value}</div>
			<div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{helper}</div>
		</div>
	);
}

function ActionPanel({
	icon,
	title,
	body,
	actionLabel,
	onAction,
	danger,
}: {
	icon: ReactNode;
	title: string;
	body: string;
	actionLabel: string;
	onAction: () => void;
	danger?: boolean;
}) {
	return (
		<div className="deck-surface flex flex-col p-5">
			<div className={`flex size-10 items-center justify-center rounded-2xl ${danger ? 'bg-red-500/10 text-red-500' : 'bg-amber-400/12 text-amber-700 dark:text-amber-300'}`}>
				{icon}
			</div>
			<div className="mt-5 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</div>
			<p className="mt-2 mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{body}</p>
			<Button
				size="default"
				variant={danger ? 'destructive' : 'outline'}
				onClick={onAction}
				className="w-full font-mono text-[12px] uppercase tracking-widest"
			>
				{actionLabel}
			</Button>
		</div>
	);
}

function feedbackClassName(tone?: FeedbackTone) {
	if (tone === 'success') {
		return 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300';
	}

	if (tone === 'error') {
		return 'border-red-500/25 bg-red-500/8 text-red-700 dark:text-red-300';
	}

	if (tone === 'info') {
		return 'border-amber-400/25 bg-amber-400/8 text-amber-700 dark:text-amber-300';
	}

	return 'border-zinc-200/70 bg-white/80 text-zinc-500 dark:border-white/8 dark:bg-zinc-950/78 dark:text-zinc-400';
}

function formatImportFeedback(locale: 'zh' | 'en', base: string, result: ImportSnapshotResult) {
	const versionLabel = result.importedVersion === 'legacy' ? (locale === 'zh' ? '旧版格式' : 'legacy format') : `v${result.importedVersion}`;
	const sourceLabel =
		result.source === 'snapshot'
			? locale === 'zh'
				? '标准快照'
				: 'snapshot'
			: result.source === 'persisted-state'
				? locale === 'zh'
					? '持久化状态'
					: 'persisted state'
				: result.source === 'legacy-records'
					? locale === 'zh'
						? '旧版记录'
						: 'legacy records'
					: locale === 'zh'
						? '兼容状态'
						: 'state payload';

	if (locale === 'zh') {
		if (result.futureVersion) {
			return `${base} 已按兼容模式导入 ${sourceLabel} ${versionLabel}。`;
		}

		if (result.migrated) {
			return `${base} 已迁移 ${sourceLabel} ${versionLabel}。`;
		}

		return `${base} ${sourceLabel} ${versionLabel}`;
	}

	if (result.futureVersion) {
		return `${base} Imported ${sourceLabel} ${versionLabel} in compatibility mode.`;
	}

	if (result.migrated) {
		return `${base} Migrated ${sourceLabel} ${versionLabel}.`;
	}

	return `${base} ${sourceLabel} ${versionLabel}`;
}
