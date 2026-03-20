'use client';

import Image from 'next/image';
import type { ChangeEvent, ReactNode } from 'react';
import { startTransition, useEffect, useRef, useState } from 'react';
import { Check, Copy, Database, Download, Link2, QrCode, RotateCcw, ShieldAlert, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

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
import { parseImportSnapshot, type ParsedImportSnapshot } from '@/lib/storeSnapshot';
import { MAX_SYNC_URL_LENGTH, buildSyncUrl, decodeSnapshotFromSyncPayload, extractSyncPayloadFromHash, getSyncPreview, type SyncPreview } from '@/lib/syncLink';
import type { SprintSnapshot } from '@/store/useStore';
import type { ImportSnapshotResult } from '@/store/useStore';
import { useStore } from '@/store/useStore';

type FeedbackTone = 'success' | 'error' | 'info';

type SyncDraft = {
	url: string;
	qrDataUrl: string | null;
	preview: SyncPreview;
	linkLength: number;
	rawBytes: number;
	compressionRatio: number;
};

type PendingSyncImport = {
	snapshot: SprintSnapshot;
	preview: SyncPreview;
	linkLength: number;
};

type PendingFileImport = {
	fileName: string;
	payload: unknown;
	parsed: ParsedImportSnapshot;
	rawBytes: number;
};

type FeedbackState = {
	tone: FeedbackTone;
	text: string;
	at: number;
};

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
	const syncLinkRef = useRef<HTMLTextAreaElement | null>(null);
	const [feedback, setFeedback] = useState<FeedbackState | null>(null);
	const [resetOpen, setResetOpen] = useState(false);
	const [qrOpen, setQrOpen] = useState(false);
	const [importOpen, setImportOpen] = useState(false);
	const [syncImportOpen, setSyncImportOpen] = useState(false);
	const [syncDraft, setSyncDraft] = useState<SyncDraft | null>(null);
	const [pendingSyncImport, setPendingSyncImport] = useState<PendingSyncImport | null>(null);
	const [pendingFileImport, setPendingFileImport] = useState<PendingFileImport | null>(null);
	const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

	const recordedSessions = sessions.filter((session) => session.status !== 'not-started').length;
	const reviewedSessions = sessions.filter((session) => session.status === 'debugged').length;
	const activeSessionLabel = sessions.find((session) => session.id === activeSessionId)?.label ?? activeSessionId;

	const pushFeedback = (tone: FeedbackTone, text: string) => {
		setFeedback({ tone, text, at: Date.now() });
	};

	useEffect(() => {
		if (!syncDraft) {
			return;
		}

		syncLinkRef.current?.focus();
		syncLinkRef.current?.select();
	}, [syncDraft]);

	useEffect(() => {
		if (copyState !== 'copied') {
			return undefined;
		}

		const timeoutId = window.setTimeout(() => {
			setCopyState('idle');
		}, 2200);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [copyState]);

	useEffect(() => {
		if (typeof window === 'undefined') {
			return undefined;
		}

		const syncFromHash = () => {
			const payload = extractSyncPayloadFromHash(window.location.hash);

			if (!payload) {
				setPendingSyncImport(null);
				return;
			}

			try {
				const snapshot = decodeSnapshotFromSyncPayload(payload);
				setPendingSyncImport({
					snapshot,
					preview: getSyncPreview(snapshot),
					linkLength: window.location.href.length,
				});
				setSyncImportOpen(true);
			} catch {
				setPendingSyncImport(null);
				setSyncImportOpen(false);
				pushFeedback('error', locale === 'zh' ? `${copy.importFailure} 同步链接无效。` : `${copy.importFailure} Invalid sync link.`);
			}
		};

		syncFromHash();
		window.addEventListener('hashchange', syncFromHash);

		return () => {
			window.removeEventListener('hashchange', syncFromHash);
		};
	}, [copy.importFailure, locale]);

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

			pushFeedback('success', `${copy.exportSuccess} v${snapshot.version}`);
		} catch {
			pushFeedback('error', copy.exportFailure);
		}
	};

	const handleGenerateSyncLink = async () => {
		if (typeof window === 'undefined') {
			return;
		}

		try {
			const snapshot = exportSnapshot();
			const rawBytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
			const url = buildSyncUrl(snapshot, window.location.href);

			if (url.length > MAX_SYNC_URL_LENGTH) {
				setSyncDraft(null);
				pushFeedback('error', copy.syncTooLarge);
				return;
			}

			let qrDataUrl: string | null = null;

			try {
				const { default: QRCode } = await import('qrcode');
				qrDataUrl = await QRCode.toDataURL(url, {
					errorCorrectionLevel: 'L',
					margin: 1,
					scale: 8,
				});
			} catch {
				qrDataUrl = null;
			}

			startTransition(() => {
				setSyncDraft({
					url,
					qrDataUrl,
					preview: getSyncPreview(snapshot),
					linkLength: url.length,
					rawBytes,
					compressionRatio: Math.max(1, Math.round((url.length / rawBytes) * 100)),
				});
				setCopyState('idle');
			});
			pushFeedback('success', copy.syncSuccess);
		} catch {
			pushFeedback('error', copy.syncFailure);
		}
	};

	const handleCopySyncLink = async () => {
		if (!syncDraft?.url || typeof navigator === 'undefined' || !navigator.clipboard) {
			pushFeedback('error', copy.syncFailure);
			return;
		}

		try {
			await navigator.clipboard.writeText(syncDraft.url);
			setCopyState('copied');
			pushFeedback('success', copy.syncCopied);
		} catch {
			pushFeedback('error', copy.syncFailure);
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
			const preview = parseImportSnapshot(parsed);
			setPendingFileImport({
				fileName: file.name,
				payload: parsed,
				parsed: preview,
				rawBytes: new TextEncoder().encode(rawText).length,
			});
			setImportOpen(true);
		} catch (error) {
			pushFeedback('error', error instanceof Error && error.message ? `${copy.importFailure} ${error.message}` : copy.importFailure);
		} finally {
			event.target.value = '';
		}
	};

	const handleConfirmFileImport = () => {
		if (!pendingFileImport) {
			return;
		}

		const result = importSnapshot(pendingFileImport.payload);
		setImportOpen(false);
		setPendingFileImport(null);
		pushFeedback('success', formatImportFeedback(locale, copy.importSuccess, result));
	};

	const clearSyncHash = () => {
		if (typeof window === 'undefined') {
			return;
		}

		window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
	};

	const handleImportFromSyncLink = () => {
		if (!pendingSyncImport) {
			return;
		}

		const result = importSnapshot(pendingSyncImport.snapshot);
		pushFeedback('success', formatImportFeedback(locale, copy.importSuccess, result));
		setPendingSyncImport(null);
		setSyncImportOpen(false);
		clearSyncHash();
	};

	const handleDismissSyncLink = () => {
		setPendingSyncImport(null);
		setSyncImportOpen(false);
		clearSyncHash();
	};

	const handleReset = () => {
		resetProgress();
		setResetOpen(false);
		pushFeedback('info', copy.resetSuccess);
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
				<CardContent className="grid gap-4 p-4 sm:p-6 xl:grid-cols-4">
					<motion.div 
						className="xl:col-span-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
						variants={{
							hidden: { opacity: 0 },
							show: { opacity: 1, transition: { staggerChildren: 0.08 } }
						}}
						initial="hidden"
						animate="show"
					>
						{[
							{ label: locale === 'zh' ? '已录入套题' : 'Recorded Sets', value: `${recordedSessions}/20`, helper: locale === 'zh' ? '已保存计时或复盘数据' : 'Sets with saved timer or review data' },
							{ label: locale === 'zh' ? '已完成复盘' : 'Reviewed', value: `${reviewedSessions}/20`, helper: locale === 'zh' ? '已标记 debugged 的节点' : 'Sessions marked as reviewed' },
							{ label: locale === 'zh' ? '历史成绩' : 'History Records', value: `${historicalScores.length}`, helper: locale === 'zh' ? '手动录入与估分记录' : 'Manual and estimated score entries' },
							{ label: locale === 'zh' ? '当前定位' : 'Active Session', value: activeSessionLabel, helper: examDate }
						].map((item, i) => (
							<motion.div key={i} variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0 } } }}>
								<SummaryTile {...item} />
							</motion.div>
						))}
					</motion.div>

					<motion.div className="xl:col-span-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }} initial="hidden" animate="show">
						<motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }}>
							<ActionPanel icon={<Download className="size-5" />} title={copy.exportTitle} body={copy.exportBody} actionLabel={copy.exportAction} onAction={handleExport} />
						</motion.div>
						<motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }}>
							<ActionPanel icon={<Upload className="size-5" />} title={copy.importTitle} body={copy.importBody} actionLabel={copy.importAction} onAction={handleImportClick} />
						</motion.div>
						<motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }}>
							<ActionPanel icon={<Link2 className="size-5" />} title={copy.syncTitle} body={copy.syncBody} actionLabel={copy.syncAction} onAction={() => { void handleGenerateSyncLink(); }} />
						</motion.div>
						<motion.div variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', bounce: 0 } } }}>
							<ActionPanel icon={<RotateCcw className="size-5" />} title={copy.resetTitle} body={copy.resetBody} actionLabel={copy.resetAction} onAction={() => setResetOpen(true)} danger />
						</motion.div>
					</motion.div>

					{syncDraft ? (
						<div className="xl:col-span-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
							<div className="deck-surface flex flex-col p-5">
								<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
									<Link2 className="size-3.5" />
									{copy.syncTitle}
								</div>
								<textarea
									ref={syncLinkRef}
									readOnly
									value={syncDraft.url}
									onFocus={(event) => event.currentTarget.select()}
									onClick={(event) => event.currentTarget.select()}
									className="mt-4 min-h-40 w-full resize-none rounded-2xl border border-zinc-200/80 bg-white/90 px-4 py-3 text-[11px] leading-6 text-zinc-600 outline-none sm:min-h-32 sm:text-xs dark:border-white/10 dark:bg-zinc-950/80 dark:text-zinc-300"
								/>
								<div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
									<Button variant="outline" onClick={() => void handleCopySyncLink()} className="w-full font-mono text-[12px] uppercase tracking-widest sm:w-auto">
										{copyState === 'copied' ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
										{copyState === 'copied' ? copy.syncCopiedAction : copy.syncCopyAction}
									</Button>
									<Button
										variant="outline"
										onClick={() => setQrOpen(true)}
										className="w-full font-mono text-[12px] uppercase tracking-widest sm:w-auto"
										disabled={!syncDraft.qrDataUrl}
									>
										<QrCode className="mr-2 size-4" />
										{copy.syncQrAction}
									</Button>
								</div>
							</div>

							<div className="deck-surface-soft grid gap-3 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-1">
								<SyncMetric label={copy.syncPreviewVersion} value={`v${syncDraft.preview.version}`} />
								<SyncMetric label={copy.syncPreviewSessions} value={`${syncDraft.preview.sessionCount}`} />
								<SyncMetric label={copy.syncPreviewHistory} value={`${syncDraft.preview.historyCount}`} />
								<SyncMetric label={copy.syncPreviewActive} value={syncDraft.preview.activeSessionId} />
								<SyncMetric label={copy.syncPreviewExportedAt} value={formatExportedAt(syncDraft.preview.exportedAt)} />
								<SyncMetric label={copy.syncPreviewSize} value={`${syncDraft.linkLength}`} />
								<SyncMetric label={copy.syncPreviewCompression} value={`${syncDraft.compressionRatio}%`} />
							</div>
						</div>
					) : null}

					<div className="xl:col-span-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
						<div className="deck-surface-soft flex flex-col justify-center p-4 sm:p-5">
							<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
								<Database className="size-3.5" />
								{copy.dataVaultNotes}
							</div>
							<div className="mt-4 flex flex-col gap-2 text-[13px] leading-5 text-zinc-600 dark:text-zinc-300">
								<p>{copy.dataVaultNoteExport}</p>
								<p>{copy.dataVaultNoteImport}</p>
								<p>{copy.dataVaultNoteSync}</p>
								<p>{copy.dataVaultNoteReset}</p>
							</div>
						</div>

						<div className="deck-surface-strong flex flex-col p-4 sm:p-5">
							<div className="flex items-center justify-between gap-3">
								<div className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
									{copy.lastOperation}
								</div>
								<div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
									{feedback ? formatFeedbackTime(feedback.at, locale) : copy.dataVaultIdleMeta}
								</div>
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
				<DialogContent
        showCloseButton={false}
        className="max-w-lg border border-white/65 bg-white/92 p-0 dark:border-white/10 dark:bg-zinc-950/92 rounded-[28px] sm:rounded-[32px] shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] overflow-visible"
      >
					<DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
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
					<DialogFooter className="mx-0! mb-0! rounded-b-[28px] border-white/60 bg-white/70 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-white/8 dark:bg-white/4 sm:px-6">
						<Button variant="outline" onClick={() => setResetOpen(false)} className="w-full sm:w-auto">
							{copy.cancelAction}
						</Button>
						<Button variant="destructive" onClick={handleReset} className="w-full sm:w-auto">
							{copy.confirmResetAction}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={importOpen}
				onOpenChange={(open) => {
					setImportOpen(open);
					if (!open) {
						setPendingFileImport(null);
					}
				}}
			>
				<DialogContent showCloseButton={false} className="max-w-lg rounded-[28px] border border-white/65 bg-white/92 p-0 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/92 overflow-hidden">
					<DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
						<div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-700 dark:text-amber-300">
							<Upload className="size-5" />
						</div>
						<DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{copy.importDialogTitle}</DialogTitle>
						<DialogDescription className="text-sm leading-7">{copy.importDialogBody}</DialogDescription>
					</DialogHeader>
					{pendingFileImport ? (
						<div className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
							<div className="deck-surface-soft grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
								<SyncMetric label={copy.importPreviewFile} value={pendingFileImport.fileName} />
								<SyncMetric label={copy.syncPreviewVersion} value={formatImportedVersion(locale, pendingFileImport.parsed.result.importedVersion)} />
								<SyncMetric label={copy.importPreviewSource} value={formatImportSourceLabel(locale, pendingFileImport.parsed.result.source)} />
								<SyncMetric label={copy.syncPreviewSessions} value={`${pendingFileImport.parsed.sessions.length}`} />
								<SyncMetric label={copy.syncPreviewHistory} value={`${pendingFileImport.parsed.historicalScores.length}`} />
								<SyncMetric label={copy.syncPreviewActive} value={pendingFileImport.parsed.activeSessionId} />
								<SyncMetric label={copy.importPreviewExamDate} value={pendingFileImport.parsed.examDate} />
								<SyncMetric label={copy.importPreviewSize} value={formatBytes(pendingFileImport.rawBytes)} />
							</div>
							<div className="rounded-[22px] border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
								{copy.importDialogWarning}
							</div>
						</div>
					) : null}
					<DialogFooter className="mx-0! mb-0! rounded-b-[28px] border-white/60 bg-white/70 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-white/8 dark:bg-white/4 sm:px-6">
						<Button variant="outline" onClick={() => setImportOpen(false)} className="w-full sm:w-auto">
							{copy.cancelAction}
						</Button>
						<Button onClick={handleConfirmFileImport} className="w-full sm:w-auto">
							{copy.importConfirmAction}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={syncImportOpen}
				onOpenChange={(open) => {
					if (!open) {
						handleDismissSyncLink();
						return;
					}

					setSyncImportOpen(true);
				}}
			>
				<DialogContent showCloseButton={false} className="max-w-lg rounded-[28px] border border-white/65 bg-white/92 p-0 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/92 overflow-hidden">
					<DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
						<div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
							<Link2 className="size-5" />
						</div>
						<DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{copy.syncDetectedTitle}</DialogTitle>
						<DialogDescription className="text-sm leading-7">{copy.syncDetectedBody}</DialogDescription>
					</DialogHeader>
					{pendingSyncImport ? (
						<div className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
							<div className="deck-surface-soft grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
								<SyncMetric label={copy.syncPreviewVersion} value={`v${pendingSyncImport.preview.version}`} />
								<SyncMetric label={copy.syncPreviewSessions} value={`${pendingSyncImport.preview.sessionCount}`} />
								<SyncMetric label={copy.syncPreviewHistory} value={`${pendingSyncImport.preview.historyCount}`} />
								<SyncMetric label={copy.syncPreviewActive} value={pendingSyncImport.preview.activeSessionId} />
								<SyncMetric label={copy.syncPreviewExportedAt} value={formatExportedAt(pendingSyncImport.preview.exportedAt)} />
								<SyncMetric label={copy.syncPreviewSize} value={`${pendingSyncImport.linkLength}`} />
							</div>
							<div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm leading-6 text-emerald-800 dark:text-emerald-200">
								{copy.syncDialogWarning}
							</div>
						</div>
					) : null}
					<DialogFooter className="mx-0! mb-0! rounded-b-[28px] border-white/60 bg-white/70 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] dark:border-white/8 dark:bg-white/4 sm:px-6">
						<Button variant="outline" onClick={handleDismissSyncLink} className="w-full sm:w-auto">
							{copy.syncDismissAction}
						</Button>
						<Button onClick={handleImportFromSyncLink} className="w-full sm:w-auto">
							{copy.syncImportAction}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={qrOpen} onOpenChange={setQrOpen}>
				<DialogContent className="max-w-md rounded-[28px] border border-white/65 bg-white/92 p-0 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/92 overflow-hidden">
					<DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
						<DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{copy.syncQrTitle}</DialogTitle>
						<DialogDescription className="text-sm leading-7">{copy.syncQrBody}</DialogDescription>
					</DialogHeader>
					<div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
						<div className="deck-surface-soft flex items-center justify-center rounded-[24px] p-4 sm:p-6">
							{syncDraft?.qrDataUrl ? (
								<Image src={syncDraft.qrDataUrl} alt={copy.syncQrTitle} width={256} height={256} className="h-auto w-full max-w-64 rounded-2xl bg-white p-3" unoptimized />
							) : (
								<div className="text-sm text-zinc-500 dark:text-zinc-400">{copy.syncFailure}</div>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

function SyncMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-[22px] border border-white/65 bg-white/78 px-4 py-3 dark:border-white/10 dark:bg-white/3">
			<div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</div>
			<div className="mt-2 wrap-break-word text-sm font-semibold leading-6 text-zinc-950 dark:text-zinc-50">{value}</div>
		</div>
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
		<div className="deck-surface flex flex-col p-4 sm:p-5">
			<div className={`flex size-10 items-center justify-center rounded-2xl ${danger ? 'bg-red-500/10 text-red-500' : 'bg-amber-400/12 text-amber-700 dark:text-amber-300'}`}>
				{icon}
			</div>
			<div className="mt-5 text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</div>
			<p className="mt-2 mb-6 flex-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{body}</p>
			<Button
				size="default"
				variant={danger ? 'destructive' : 'outline'}
				onClick={onAction}
				className="min-h-10 w-full font-mono text-[12px] uppercase tracking-widest"
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

function formatImportSourceLabel(locale: 'zh' | 'en', source: ImportSnapshotResult['source']) {
	if (source === 'snapshot') {
		return locale === 'zh' ? '标准快照' : 'snapshot';
	}

	if (source === 'persisted-state') {
		return locale === 'zh' ? '持久化状态' : 'persisted state';
	}

	if (source === 'legacy-records') {
		return locale === 'zh' ? '旧版记录' : 'legacy records';
	}

	return locale === 'zh' ? '兼容状态' : 'state payload';
}

function formatImportedVersion(locale: 'zh' | 'en', version: ImportSnapshotResult['importedVersion']) {
	return version === 'legacy' ? (locale === 'zh' ? '旧版格式' : 'legacy format') : `v${version}`;
}

function formatImportFeedback(locale: 'zh' | 'en', base: string, result: ImportSnapshotResult) {
	const versionLabel = formatImportedVersion(locale, result.importedVersion);
	const sourceLabel = formatImportSourceLabel(locale, result.source);

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

function formatExportedAt(value: string) {
	return value.replace('T', ' ').replace('.000Z', ' UTC');
}

function formatBytes(value: number) {
	if (value < 1024) {
		return `${value} B`;
	}

	return `${(value / 1024).toFixed(1)} KB`;
}

function formatFeedbackTime(timestamp: number, locale: 'zh' | 'en') {
	const label = new Date(timestamp).toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

	return locale === 'zh' ? `更新于 ${label}` : `Updated ${label}`;
}
