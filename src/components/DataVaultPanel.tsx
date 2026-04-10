'use client';

import Image from 'next/image';
import type { ChangeEvent } from 'react';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Bot, Check, CheckCircle2, Copy, Database, Download, Info, Link2, QrCode, RotateCcw, ShieldAlert, Upload, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getCopy } from '@/lib/i18n';
import { getAutoBackups, parseImportSnapshot, type ParsedImportSnapshot, type AutoBackupEntry } from '@/lib/storeSnapshot';
import { MAX_SYNC_URL_LENGTH, buildSyncUrl, decodeSnapshotFromSyncPayload, extractSyncPayloadFromHash, getSyncPreview, type SyncPreview } from '@/lib/syncLink';
import type { SprintSnapshot } from '@/store/useStore';
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
	const vocabularyEntries = useStore((state) => state.vocabularyEntries);
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
	const [autoBackups, setAutoBackups] = useState<AutoBackupEntry[]>([]);
	const [includeVocabularyInSync, setIncludeVocabularyInSync] = useState(true);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			setAutoBackups(getAutoBackups(window.localStorage));
		}
	}, []);

	const recordedSessions = sessions.filter((session) => session.status !== 'not-started').length;
	const reviewedSessions = sessions.filter((session) => session.status === 'debugged').length;
	const activeSessionLabel = sessions.find((session) => session.id === activeSessionId)?.label ?? activeSessionId;

	const pushFeedback = (tone: FeedbackTone, text: string) => {
		setFeedback({ tone, text, at: Date.now() });
	};

	const previewImportFromRaw = (rawText: string, fileName: string) => {
		const parsed = JSON.parse(rawText) as unknown;
		const preview = parseImportSnapshot(parsed, useStore.getState());
		setPendingFileImport({
			fileName,
			payload: parsed,
			parsed: preview,
			rawBytes: new TextEncoder().encode(rawText).length,
		});
		setImportOpen(true);
	};

	const triggerFileDownload = (blob: Blob, fileName: string) => {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');

		anchor.href = url;
		anchor.download = fileName;
		anchor.style.display = 'none';
		document.body.appendChild(anchor);
		anchor.click();

		window.setTimeout(() => {
			URL.revokeObjectURL(url);
			anchor.remove();
		}, 1000);
	};

	useEffect(() => {
		if (!syncDraft) {
			return;
		}

		syncLinkRef.current?.focus();
		syncLinkRef.current?.select();
	}, [syncDraft]);

	// Listen for paste anywhere on the page to intercept JSON snapshots or vocabulary lists.
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

			const pasted = e.clipboardData?.getData('text');
			if (!pasted) return;

			const trimmed = pasted.trim();
			if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) {
				return;
			}

			try {
				previewImportFromRaw(trimmed, locale === 'zh' ? '剪贴板导入' : 'Clipboard Import');
				e.preventDefault();
			} catch {
				// Ignore unrelated or invalid JSON pastes.
			}
		};

		window.addEventListener('paste', handlePaste);
		return () => window.removeEventListener('paste', handlePaste);
	}, [locale]);

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
		if (!feedback) {
			return undefined;
		}

		const timeoutId = window.setTimeout(() => {
			setFeedback(null);
		}, 3600);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [feedback]);

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
			const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
			const date = snapshot.exportedAt.slice(0, 10);

			triggerFileDownload(blob, `cheese-toeic-tracker-v${snapshot.version}-${date}.json`);

			pushFeedback('success', `${copy.exportSuccess} v${snapshot.version}`);
		} catch {
			pushFeedback('error', copy.exportFailure);
		}
	};

	const handleExportVocabularyList = () => {
		try {
			const words = [...new Set(vocabularyEntries
				.map((entry) => (typeof entry?.text === 'string' ? entry.text.trim() : ''))
				.filter(Boolean))]
				.sort((left, right) => left.localeCompare(right));

			if (words.length === 0) {
				pushFeedback('error', copy.exportVocabularyEmpty);
				return;
			}

			const blob = new Blob([`${words.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
			const date = new Date().toISOString().slice(0, 10);

			triggerFileDownload(blob, `cheese-toeic-vocabulary-${date}.txt`);

			pushFeedback('success', copy.exportVocabularySuccess(words.length));
		} catch {
			pushFeedback('error', copy.exportFailure);
		}
	};

	const handleGenerateAIPrompt = async () => {
		const wordsSubset = [...new Map(vocabularyEntries
			.filter((entry) => typeof entry?.text === 'string' && entry.text.trim())
			.map(entry => [entry.text.trim().toLowerCase(), {
				text: entry.text.trim(),
				reading: entry.reading || "",
				partOfSpeech: entry.partOfSpeech || "",
				definition: entry.definition || "",
				enDefinition: entry.enDefinition || "",
				exampleSentence: entry.exampleSentence || "",
				encounterCount: entry.encounterCount || 0,
				knockdownCount: entry.knockdownCount || 0
			}])
		).values()].sort((a, b) => a.text.localeCompare(b.text));

		if (wordsSubset.length === 0) {
			pushFeedback('error', copy.exportVocabularyEmpty);
			return;
		}

		const { generateToeicOptimizationPrompt } = await import('@/lib/aiPrompts');
		const prompt = generateToeicOptimizationPrompt(wordsSubset);

		try {
			await navigator.clipboard.writeText(prompt);
			pushFeedback('success', copy.copyAiPromptSuccess);
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
			const url = buildSyncUrl(snapshot, window.location.href, {
				includeVocabulary: includeVocabularyInSync,
			});

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
					preview: getSyncPreview(
						includeVocabularyInSync
							? snapshot
							: { ...snapshot, data: { ...snapshot.data, vocabularyEntries: [] } }
					),
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

	const handleImportFromClipboard = async () => {
		if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
			pushFeedback('error', locale === 'zh' ? '当前环境不支持读取剪贴板。' : 'Clipboard read is not available in this environment.');
			return;
		}

		try {
			const rawText = (await navigator.clipboard.readText()).trim();
			if (!rawText) {
				pushFeedback('error', locale === 'zh' ? '剪贴板为空。' : 'Clipboard is empty.');
				return;
			}

			previewImportFromRaw(rawText, locale === 'zh' ? '剪贴板导入' : 'Clipboard Import');
		} catch (error) {
			pushFeedback('error', error instanceof Error && error.message ? `${copy.importFailure} ${error.message}` : copy.importFailure);
		}
	};

	const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];

		if (!file) {
			return;
		}

		try {
			const rawText = await file.text();
			previewImportFromRaw(rawText, file.name);
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

	const fileDiff = useMemo(() => {
		if (!pendingFileImport) return null;
		let sessionsWillChange = 0;
		let sessionsAdded = 0;
		for (const inc of pendingFileImport.parsed.sessions) {
			const cur = sessions.find(s => s.id === inc.id);
			if (!cur) {
				sessionsAdded++;
			} else if (cur.status !== inc.status || JSON.stringify(cur.mistakes) !== JSON.stringify(inc.mistakes)) {
				sessionsWillChange++;
			}
		}
		return {
			sessionsWillChange,
			sessionsAdded,
			scoreHistoryDelta: pendingFileImport.parsed.historicalScores.length - historicalScores.length,
			examDateChanges: pendingFileImport.parsed.examDate !== examDate,
			vocabEntriesDelta: pendingFileImport.parsed.vocabularyEntries.length - vocabularyEntries.length,
		};
	}, [pendingFileImport, sessions, historicalScores, examDate, vocabularyEntries]);

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

	const handleRestoreBackup = (key: string) => {
		if (typeof window === 'undefined') return;
		try {
			const raw = window.localStorage.getItem(key);
			if (raw) {
				const parsed = JSON.parse(raw);
				const preview = parseImportSnapshot(parsed, useStore.getState());
				setPendingFileImport({
					fileName: locale === 'zh' ? '自动备份恢复' : 'Auto-Backup Restore',
					payload: parsed,
					parsed: preview,
					rawBytes: new TextEncoder().encode(raw).length,
				});
				setImportOpen(true);
			}
		} catch {
			pushFeedback('error', locale === 'zh' ? '无法读取备份文件。' : 'Failed to read backup.');
		}
	};

	const handleReset = () => {
		resetProgress();
		setResetOpen(false);
		pushFeedback('info', copy.resetSuccess);
	};

	return (
		<div className="mx-auto max-w-4xl space-y-6 sm:space-y-10 py-2 sm:py-4">
			<AnimatePresence>
				{feedback ? (
					<motion.div
						initial={{ opacity: 0, y: -14, x: 8, scale: 0.97 }}
						animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
						exit={{ opacity: 0, y: -10, x: 8, scale: 0.98 }}
						transition={{ type: 'spring', bounce: 0.16, duration: 0.34 }}
						className="pointer-events-none fixed right-3 top-22 z-60 w-72 max-w-[calc(100%-1.5rem)] sm:right-5 sm:top-24"
					>
						<div className={`pointer-events-auto overflow-hidden rounded-[20px] border backdrop-blur-2xl ${feedbackClassName(feedback.tone)}`}>
							<div className="flex items-start gap-2.5 px-3.5 pb-2.5 pt-2.5">
								<div className={`mt-0.5 rounded-full p-1.5 ${feedbackIconWrapClassName(feedback.tone)}`}>
									{feedback.tone === 'success' ? (
										<CheckCircle2 className="size-4" />
									) : feedback.tone === 'error' ? (
										<AlertCircle className="size-4" />
									) : (
										<Info className="size-4" />
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-3">
										<div>
											<div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-80">
												{copy.lastOperation}
											</div>
											<div className="mt-1 text-[13px] leading-5 wrap-break-word">{feedback.text}</div>
										</div>
										<button
											type="button"
											onClick={() => setFeedback(null)}
											className="-mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full opacity-70 transition hover:bg-white/30 hover:opacity-100 dark:hover:bg-black/20"
											aria-label={locale === 'zh' ? '关闭提示' : 'Dismiss notification'}
										>
											<X className="size-3" />
										</button>
									</div>
									<div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] opacity-65">
										{formatFeedbackTime(feedback.at, locale)}
									</div>
								</div>
							</div>
							<div className="h-1 w-full bg-white/30 dark:bg-black/20">
								<motion.div
									key={feedback.at}
									initial={{ width: '100%' }}
									animate={{ width: '0%' }}
									transition={{ duration: 3.6, ease: 'linear' }}
									className={feedbackProgressClassName(feedback.tone)}
								/>
							</div>
						</div>
					</motion.div>
				) : null}
			</AnimatePresence>

			<motion.div 
				className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 px-2"
				variants={{
					hidden: { opacity: 0 },
					show: { opacity: 1, transition: { staggerChildren: 0.08 } }
				}}
				initial="hidden"
				animate="show"
			>
				{[
					{ label: locale === 'zh' ? '已录入套题' : 'Recorded Sets', value: `${recordedSessions}/${sessions.length}`, helper: locale === 'zh' ? '已保存计时或复盘数据' : 'Sets with saved timer or review' },
					{ label: locale === 'zh' ? '已完成复盘' : 'Reviewed', value: `${reviewedSessions}/${sessions.length}`, helper: locale === 'zh' ? '已标记 debugged 的节点' : 'Sessions marked as reviewed' },
					{ label: locale === 'zh' ? '历史成绩' : 'History Records', value: `${historicalScores.length}`, helper: locale === 'zh' ? '手动录入与估分记录' : 'Manual and estimated scores' },
					{ label: locale === 'zh' ? '当前定位' : 'Active Session', value: activeSessionLabel, helper: examDate || (locale === 'zh' ? '考试日期未定' : 'No exam date') }
				].map((item, i) => (
					<motion.div key={i} variants={{ hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1, transition: { type: 'spring', bounce: 0 } } }}>
						<SummaryTile {...item} />
					</motion.div>
				))}
			</motion.div>

			<div className="space-y-6 sm:space-y-8">
				{syncDraft && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						className="deck-surface p-1 rounded-[24px]"
					>
						<div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
							<div className="flex flex-col p-4 sm:p-5">
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
								<div className="mt-4 flex flex-col sm:flex-row gap-3">
									<Button variant="outline" onClick={() => void handleCopySyncLink()} className="w-full font-mono text-[12px] uppercase tracking-widest sm:w-auto dark:hover:bg-zinc-800">
										{copyState === 'copied' ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
										{copyState === 'copied' ? copy.syncCopiedAction : copy.syncCopyAction}
									</Button>
									<Button
										variant="outline"
										onClick={() => setQrOpen(true)}
										className="w-full font-mono text-[12px] uppercase tracking-widest sm:w-auto dark:hover:bg-zinc-800"
										disabled={!syncDraft.qrDataUrl}
									>
										<QrCode className="mr-2 size-4" />
										{copy.syncQrAction}
									</Button>
									<Button variant="ghost" onClick={() => setSyncDraft(null)} className="w-full font-mono text-[12px] uppercase tracking-widest sm:w-auto sm:ml-auto opacity-70 hover:opacity-100 hidden sm:flex">
										<X className="mr-2 size-4" />
										{copy.cancelAction}
									</Button>
								</div>
							</div>

							<div className="deck-surface-soft m-1 rounded-[20px] grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-1 overflow-hidden">
								<SyncMetric label={copy.syncPreviewVersion} value={`v${syncDraft.preview.version}`} />
								<SyncMetric label={copy.syncPreviewSessions} value={`${syncDraft.preview.sessionCount}`} />
								<SyncMetric label={copy.syncPreviewHistory} value={`${syncDraft.preview.historyCount}`} />
								<SyncMetric label={copy.syncPreviewVocabulary} value={`${syncDraft.preview.vocabularyCount}`} />
								<SyncMetric label={copy.syncPreviewActive} value={syncDraft.preview.activeSessionId || ''} />
								<SyncMetric label={copy.syncPreviewSize} value={`${syncDraft.linkLength}`} />
							</div>
						</div>
					</motion.div>
				)}

				<SettingsGroup title={locale === 'zh' ? '云端同步' : 'Cloud Sync'}>
					<SettingsRow 
						icon={<Link2 />} 
						title={copy.syncTitle} 
						description={copy.syncBody} 
						onClick={() => { void handleGenerateSyncLink(); }} 
						actionLabel={copy.syncAction}
					/>
					<ToggleRow 
						icon={<Database />} 
						title={copy.syncIncludeVocabularyLabel} 
						description={copy.syncIncludeVocabularyHint} 
						checked={includeVocabularyInSync} 
						onChange={setIncludeVocabularyInSync} 
						locale={locale}
					/>
				</SettingsGroup>

				<SettingsGroup title={locale === 'zh' ? '导入与导出' : 'Import & Export'}>
					<SettingsRow icon={<Download />} title={copy.exportTitle} description={copy.exportBody} actionLabel={copy.exportAction} onClick={handleExport} />
					<SettingsRow icon={<Upload />} title={copy.importTitle} description={copy.importBody} actionLabel={copy.importAction} onClick={handleImportClick} />
					<SettingsRow icon={<Copy />} title={locale === 'zh' ? '从剪贴板导入' : 'Import From Clipboard'} description={locale === 'zh' ? '自动检测剪贴板内的快照或词表数据' : 'Detect snapshot or vocabulary JSON from clipboard'} actionLabel={locale === 'zh' ? '读取剪贴板' : 'Read Clipboard'} onClick={() => { void handleImportFromClipboard(); }} />
				</SettingsGroup>

				<SettingsGroup title={locale === 'zh' ? '词表与 AI 分析' : 'Vocabulary & AI Analysis'}>
					<SettingsRow icon={<Bot className="text-amber-600 dark:text-amber-500" />} title={copy.copyAiPromptTitle} description={copy.copyAiPromptBody} actionLabel={copy.copyAiPromptAction} onClick={() => { void handleGenerateAIPrompt(); }} />
					<SettingsRow icon={<Download />} title={copy.exportVocabularyTitle} description={copy.exportVocabularyBody} actionLabel={copy.exportVocabularyAction} onClick={handleExportVocabularyList} />
				</SettingsGroup>

				{autoBackups.length > 0 && (
					<SettingsGroup title={locale === 'zh' ? '自动备份 (防灾恢复)' : 'Auto-Backups (Disaster Recovery)'}>
						{autoBackups.map((bk) => (
							<SettingsRow 
								key={bk.key} 
								icon={<RotateCcw className="text-indigo-500" />} 
								title={formatExportedAt(bk.exportedAt)} 
								description={`${bk.sessionCount} ${locale === 'zh' ? '组记录' : 'records'}, ${bk.debuggedCount} ${locale === 'zh' ? '已知晓' : 'reviewed'}`}
								actionLabel={locale === 'zh' ? '加载' : 'Load'}
								onClick={() => handleRestoreBackup(bk.key)} 
							/>
						))}
					</SettingsGroup>
				)}

				<SettingsGroup title={locale === 'zh' ? '危险区域' : 'Danger Zone'} danger>
					<SettingsRow icon={<RotateCcw />} title={copy.resetTitle} description={copy.resetBody} actionLabel={copy.resetAction} onClick={() => setResetOpen(true)} danger />
				</SettingsGroup>
			</div>

			<Input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />

			{/* Dialogs */}
			<Dialog open={resetOpen} onOpenChange={setResetOpen}>
				<DialogContent showCloseButton={false} className="max-w-lg border border-white/65 bg-white/92 p-0 dark:border-white/10 dark:bg-zinc-950/92 rounded-[28px] sm:rounded-[32px] shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] overflow-visible">
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

			<Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setPendingFileImport(null); }}>
				<DialogContent showCloseButton={false} className="max-w-lg rounded-[28px] border border-white/65 bg-white/92 p-0 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/92 overflow-hidden">
					<DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
						<div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-700 dark:text-amber-300">
							<Upload className="size-5" />
						</div>
						<DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{copy.importDialogTitle}</DialogTitle>
						<DialogDescription className="text-sm leading-7">{copy.importDialogBody}</DialogDescription>
					</DialogHeader>
					{pendingFileImport && (
						<div className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
							<div className="deck-surface-soft grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
								<SyncMetric label={copy.importPreviewFile} value={pendingFileImport.fileName} />
								<SyncMetric label={copy.syncPreviewVersion} value={formatImportedVersion(locale, pendingFileImport.parsed.result.importedVersion || '')} />
								<SyncMetric label={copy.importPreviewSource} value={formatImportSourceLabel(locale, pendingFileImport.parsed.result.source || '')} />
								<SyncMetric label={copy.syncPreviewSessions} value={`${pendingFileImport.parsed.sessions.length}`} diff={fileDiff?.sessionsAdded ? `+${fileDiff.sessionsAdded}` : undefined} />
								<SyncMetric label={copy.syncPreviewHistory} value={`${pendingFileImport.parsed.historicalScores.length}`} diff={fileDiff?.scoreHistoryDelta ? (fileDiff.scoreHistoryDelta > 0 ? `+${fileDiff.scoreHistoryDelta}` : `${fileDiff.scoreHistoryDelta}`) : undefined} />
								<SyncMetric label={locale === 'zh' ? '生词本' : 'Vocabulary'} value={`${pendingFileImport.parsed.vocabularyEntries.length}`} diff={fileDiff?.vocabEntriesDelta ? (fileDiff.vocabEntriesDelta > 0 ? `+${fileDiff.vocabEntriesDelta}` : `${fileDiff.vocabEntriesDelta}`) : undefined} />
								<SyncMetric label={copy.importPreviewExamDate} value={pendingFileImport.parsed.examDate || ''} changed={fileDiff?.examDateChanges} />
								<SyncMetric label={copy.importPreviewSize} value={formatBytes(pendingFileImport.rawBytes)} />
							</div>
							
							{fileDiff && fileDiff.sessionsWillChange > 0 && (
								<div className="flex items-center gap-2 rounded-[14px] bg-amber-50 dark:bg-amber-500/10 px-4 py-2 border border-amber-200/50 dark:border-amber-500/20">
									<ArrowRight className="size-4 text-amber-500" />
									<span className="text-sm font-medium text-amber-800 dark:text-amber-200">
										{locale === 'zh' ? `将覆盖更新 ${fileDiff.sessionsWillChange} 个已有进度的套题` : `Will overwrite progress for ${fileDiff.sessionsWillChange} existing sets`}
									</span>
								</div>
							)}

							<div className="rounded-[22px] border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-[13px] leading-5 text-amber-800 dark:text-amber-200">
								{copy.importDialogWarning}
							</div>
						</div>
					)}
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

			<Dialog open={syncImportOpen} onOpenChange={(open) => { if (!open) handleDismissSyncLink(); else setSyncImportOpen(true); }}>
				<DialogContent showCloseButton={false} className="max-w-lg rounded-[28px] border border-white/65 bg-white/92 p-0 shadow-[0_24px_90px_-50px_rgba(15,23,42,0.3)] dark:border-white/10 dark:bg-zinc-950/92 overflow-hidden">
					<DialogHeader className="px-5 pt-5 sm:px-6 sm:pt-6">
						<div className="mb-3 flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
							<Link2 className="size-5" />
						</div>
						<DialogTitle className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{copy.syncDetectedTitle}</DialogTitle>
						<DialogDescription className="text-sm leading-7">{copy.syncDetectedBody}</DialogDescription>
					</DialogHeader>
					{pendingSyncImport && (
						<div className="grid gap-4 px-5 pb-5 sm:px-6 sm:pb-6">
							<div className="deck-surface-soft grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
								<SyncMetric label={copy.syncPreviewVersion} value={`v${pendingSyncImport.preview.version}`} />
								<SyncMetric label={copy.syncPreviewSessions} value={`${pendingSyncImport.preview.sessionCount}`} />
								<SyncMetric label={copy.syncPreviewHistory} value={`${pendingSyncImport.preview.historyCount}`} />
								<SyncMetric label={copy.syncPreviewVocabulary} value={`${pendingSyncImport.preview.vocabularyCount}`} />
								<SyncMetric label={copy.syncPreviewActive} value={pendingSyncImport.preview.activeSessionId || ''} />
								<SyncMetric label={copy.syncPreviewExportedAt} value={formatExportedAt(pendingSyncImport.preview.exportedAt)} />
								<SyncMetric label={copy.syncPreviewSize} value={`${pendingSyncImport.linkLength}`} />
							</div>
							<div className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-[13px] leading-5 text-emerald-800 dark:text-emerald-200">
								{copy.syncDialogWarning}
							</div>
						</div>
					)}
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
		</div>
	);
}

function SettingsGroup({ title, children, danger }: { title?: string; children: React.ReactNode; danger?: boolean; }) {
	return (
		<div className="flex flex-col gap-2">
			{title && (
				<div className={`pl-5 text-xs font-bold uppercase tracking-[0.15em] ${danger ? 'text-red-500/80 dark:text-red-400/80' : 'text-zinc-500/80 dark:text-zinc-400/80'}`}>
					{title}
				</div>
			)}
			<div className="deck-surface flex flex-col rounded-[24px] overflow-hidden divide-y divide-zinc-200/60 dark:divide-zinc-800/60 transition-shadow hover:shadow-xs">
				{children}
			</div>
		</div>
	);
}

function SettingsRow({ icon, title, description, actionLabel, onClick, danger }: { icon: React.ReactNode; title: string; description?: string; actionLabel: string; onClick: () => void; danger?: boolean; }) {
	return (
		<div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
			<div className="flex items-start sm:items-center gap-4 min-w-0 pr-4">
				<div className={`mt-0.5 sm:mt-0 flex size-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300'}`}>
					{icon}
				</div>
				<div className="min-w-0">
					<div className={`text-[14px] font-semibold tracking-tight ${danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
						{title}
					</div>
					{description && <div className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400 max-w-xl">{description}</div>}
				</div>
			</div>
			<div className="pl-14 sm:pl-0 sm:shrink-0 flex items-center justify-start sm:justify-end">
				<Button variant={danger ? 'destructive' : 'secondary'} onClick={onClick} className="w-full sm:w-auto h-8 rounded-full font-mono text-[11px] uppercase tracking-wider px-5 shadow-xs dark:bg-zinc-800 dark:text-zinc-200">
					{actionLabel}
				</Button>
			</div>
		</div>
	);
}

function ToggleRow({ icon, title, description, checked, onChange, locale }: { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (v: boolean) => void; locale: 'zh' | 'en'; }) {
	return (
		<div className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
			<div className="flex items-start sm:items-center gap-4 min-w-0 pr-4">
				<div className="mt-0.5 sm:mt-0 flex size-10 shrink-0 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10 text-zinc-600 dark:text-zinc-300">
					{icon}
				</div>
				<div className="min-w-0">
					<div className="text-[14px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</div>
					<div className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400 max-w-xl">{description}</div>
				</div>
			</div>
			<div className="pl-14 sm:pl-0 sm:shrink-0 flex items-center gap-3">
				<span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
					{checked ? (locale === 'zh' ? '开启' : 'ON') : (locale === 'zh' ? '关闭' : 'OFF')}
				</span>
				<Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
			</div>
		</div>
	);
}

function SyncMetric({ label, value, diff, changed }: { label: string; value: string; diff?: string; changed?: boolean }) {
	return (
		<div className={`min-w-0 rounded-[18px] border bg-white/78 px-4 py-2.5 dark:bg-white/3 ${changed ? 'border-amber-400/40 bg-amber-400/5 dark:bg-amber-400/5' : 'border-zinc-200/60 dark:border-white/5'}`}>
			<div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</div>
			<div className="mt-1.5 text-[13px] font-semibold leading-5 text-zinc-950 dark:text-zinc-50 flex items-center gap-2 flex-wrap">
				<span className="wrap-break-word">{value}</span>
				{diff && <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{diff}</span>}
				{changed && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 rounded-full px-2 py-0 border border-amber-200 dark:border-amber-500/30">Modified</span>}
			</div>
		</div>
	);
}

function SummaryTile({ label, value, helper }: { label: string; value: string; helper: string; }) {
	return (
		<div className="deck-surface-soft rounded-[24px] p-5 flex flex-col justify-between h-full">
			<div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">{label}</div>
			<div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-zinc-950 dark:text-zinc-50">{value}</div>
			<div className="mt-2 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400 line-clamp-2">{helper}</div>
		</div>
	);
}

function feedbackClassName(tone?: string) { return tone === 'success' ? 'border-emerald-500/28 bg-emerald-500/12 text-emerald-900 dark:text-emerald-200' : tone === 'error' ? 'border-rose-500/28 bg-rose-500/12 text-rose-900 dark:text-rose-200' : tone === 'info' ? 'border-amber-400/28 bg-amber-400/12 text-amber-900 dark:text-amber-200' : 'border-zinc-200/70 bg-white/88 text-zinc-700 dark:border-white/8 dark:bg-zinc-950/82 dark:text-zinc-300'; }
function feedbackIconWrapClassName(tone: string) { return tone === 'success' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : tone === 'error' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300' : 'bg-amber-500/18 text-amber-700 dark:text-amber-300'; }
function feedbackProgressClassName(tone: string) { return tone === 'success' ? 'h-full bg-emerald-500/70' : tone === 'error' ? 'h-full bg-rose-500/70' : 'h-full bg-amber-500/70'; }
function formatImportFeedback(locale: 'zh' | 'en', message: string, result: { source: string; migrated: boolean; futureVersion: boolean; }) {
	const sourceLabel = formatImportSourceLabel(locale, result.source);

	if (locale === 'zh') {
		if (result.futureVersion) {
			return `${message} 来源：${sourceLabel}，检测到较新版本，已按兼容模式导入。`;
		}

		if (result.migrated) {
			return `${message} 已从${sourceLabel}兼容导入。`;
		}

		return `${message} 来源：${sourceLabel}。`;
	}

	if (result.futureVersion) {
		return `${message} Source: ${sourceLabel}. A newer version was detected and imported in compatibility mode.`;
	}

	if (result.migrated) {
		return `${message} Imported from ${sourceLabel} in compatibility mode.`;
	}

	return `${message} Source: ${sourceLabel}.`;
}
function formatImportSourceLabel(locale: 'zh' | 'en', source: string) { return source === 'snapshot' ? (locale === 'zh' ? '标准快照' : 'snapshot') : source === 'persisted-state' ? (locale === 'zh' ? '持久化状态' : 'persisted state') : source === 'legacy-records' ? (locale === 'zh' ? '旧版记录' : 'legacy records') : locale === 'zh' ? '兼容状态' : 'state payload'; }
function formatImportedVersion(locale: 'zh' | 'en', version: string | number) { return version === 'legacy' ? (locale === 'zh' ? '旧版格式' : 'legacy format') : `v${version}`; }
function formatExportedAt(value: string) { return value.replace('T', ' ').replace('.000Z', ' UTC'); }
function formatBytes(value: number) { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`; }
function formatFeedbackTime(timestamp: number, locale: 'zh' | 'en') { const label = new Date(timestamp).toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); return locale === 'zh' ? `更新于 ${label}` : `Updated ${label}`; }
