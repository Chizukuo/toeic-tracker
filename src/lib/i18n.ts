import {
	type MistakeKey,
	type SessionRecord,
	type SessionStatus,
} from '@/lib/toeic';

export type Locale = 'zh' | 'en';

const partLabels: Record<Locale, Record<MistakeKey, string>> = {
	zh: {
		'Part 1': 'Part 1 看图短句',
		'Part 2': 'Part 2 应答反应',
		'Part 3': 'Part 3 对话理解',
		'Part 4': 'Part 4 说明文听力',
		'Part 5': 'Part 5 语法词汇',
		'Part 6': 'Part 6 篇章填空',
		'Part 7 Single': 'Part 7 单篇阅读',
		'Part 7 Multiple': 'Part 7 多篇阅读',
	},
	en: {
		'Part 1': 'Part 1 Photo Description',
		'Part 2': 'Part 2 Response',
		'Part 3': 'Part 3 Conversations',
		'Part 4': 'Part 4 Talks',
		'Part 5': 'Part 5 Incomplete Sentences',
		'Part 6': 'Part 6 Text Completion',
		'Part 7 Single': 'Part 7 Single Passages',
		'Part 7 Multiple': 'Part 7 Multiple Passages',
	},
};

const reasonLabels = {
	zh: {
		'词汇盲区': '单词不认识',
		'连读丢包': '连读没听清',
		'口音宕机': '口音听不惯',
		'预判超时': '来不及预读题目',
		'语法结构误判': '语法判断错',
		'同义词未命中': '没认出同义替换',
		'跨表检索超时': '多篇找信息太慢',
		'长难句解析卡顿': '长难句读不懂',
	},
	en: {
		'词汇盲区': "Didn't know the word",
		'连读丢包': 'Missed linked sounds',
		'口音宕机': 'Unfamiliar accent',
		'预判超时': 'No time to preview',
		'语法结构误判': 'Grammar mistake',
		'同义词未命中': 'Missed a paraphrase',
		'跨表检索超时': 'Slow across passages',
		'长难句解析卡顿': 'Lost in a long sentence',
	},
} as const;

const statusLabels: Record<Locale, Record<SessionStatus, string>> = {
	zh: {
		'not-started': '未开始',
		'in-progress': '进行中',
		debugged: '已复盘',
	},
	en: {
		'not-started': 'Not Started',
		'in-progress': 'In Progress',
		debugged: 'Reviewed',
	},
};

type Copy = {
	appName: string;
	examCountdownLabel: string;
	status: string;
	sprintDay: (day: number) => string;
	saveDiagnostics: string;
	yes: string;
	no: string;
	unfinished: (count: number) => string;
	forcedSubmit: string;
	currentMistakes: string;
	target: string;
	session: string;
	lapSync: string;
	mistakesByPart: string;
	rootCauseTags: string;
	dataEntryTitle: string;
	dataEntryDescription: string;
	actual: string;
	baseline: string;
	doneCount: (count: number, total: number) => string;
	thisRun: (value: string) => string;
	lastRun: (value: string) => string;
	awaitingCapture: string;
	strictListeningMode: string;
	strictReadingMode: string;
	restartStrictAttempt: string;
	startStrictAttempt: string;
	runningNow: string;
	readingLapSequence: string;
	timeoutFrozen: string;
	forcedEnded: string;
	pendingSubmitBody: string;
	unfinishedPlaceholder: string;
	saveSubmitData: string;
	timeProfilingLocked: string;
	timeProfilingLockedBody: string;
	noReadingLapData: string;
	noReadingLapDataBody: string;
	strictPacingPlaceholder: string;
	readingTimeProfilingDesc: string;
	delta: string;
	mistakeTrend: string;
	weaknessRadar: string;
	rootCauseFrequency: string;
	rootCauseFrequencyDesc: string;
	saveDebugToUnlock: string;
	listeningSeries: string;
	readingSeries: string;
	errorRate: string;
	dataVaultTitle: string;
	dataVaultDescription: string;
	exportTitle: string;
	exportBody: string;
	exportAction: string;
	exportVocabularyTitle: string;
	exportVocabularyBody: string;
	exportVocabularyAction: string;
	exportVocabularyEmpty: string;
	exportVocabularySuccess: (count: number) => string;
	copyAiPromptTitle: string;
	copyAiPromptBody: string;
	copyAiPromptAction: string;
	copyAiPromptSuccess: string;
	exportSuccess: string;
	exportFailure: string;
	importTitle: string;
	importBody: string;
	importAction: string;
	importSuccess: string;
	importFailure: string;
	resetTitle: string;
	resetBody: string;
	resetAction: string;
	resetSuccess: string;
	resetDialogTitle: string;
	resetDialogBody: string;
	confirmResetAction: string;
	cancelAction: string;
	lastOperation: string;
	syncTitle: string;
	syncBody: string;
	syncAction: string;
	syncIncludeVocabularyLabel: string;
	syncIncludeVocabularyHint: string;
	syncCopyAction: string;
	syncQrAction: string;
	syncCopiedAction: string;
	syncSuccess: string;
	syncFailure: string;
	syncCopied: string;
	syncTooLarge: string;
	syncDetectedTitle: string;
	syncDetectedBody: string;
	syncDialogWarning: string;
	syncImportAction: string;
	syncDismissAction: string;
	syncPreviewVersion: string;
	syncPreviewSessions: string;
	syncPreviewHistory: string;
	syncPreviewVocabulary: string;
	syncPreviewActive: string;
	syncPreviewExportedAt: string;
	syncPreviewSize: string;
	syncQrTitle: string;
	syncQrBody: string;
	importDialogTitle: string;
	importDialogBody: string;
	importDialogWarning: string;
	importConfirmAction: string;
	importPreviewFile: string;
	importPreviewSource: string;
	importPreviewExamDate: string;
	importPreviewSize: string;
	unfinishedTrackerTitle: string;
	unfinishedTotal: string;
	unfinishedSessions: string;
	unfinishedCurrent: string;
	unfinishedLatest: string;
	unfinishedQueue: string;
	unfinishedNone: string;
	unfinishedNoneDescription: string;
	openSession: string;
	affectedCount: (count: number) => string;
	unfinishedChartHint: string;
	scoreRawCorrect: string;
	scoreMistakes: string;
	scoreAccuracy: string;
	scoreListeningLabel: string;
	scoreReadingLabel: string;
	scoreTotalLabel: string;
	missionGoalTitle: string;
	missionGoalDesc: string;
	sprintLength: string;
	sprintLengthDesc: string;
	saveConfig: string;
};

const copy: Record<Locale, Copy> = {
	zh: {
		appName: 'Cheese TOEIC Tracker',
		examCountdownLabel: '考试日期',
		status: '状态',
		sprintDay: (day) => `冲刺 Day ${day.toString().padStart(2, '0')}`,
		saveDiagnostics: '保存复盘',
		yes: '是',
		no: '否',
		unfinished: (count) => `未完成 ${count} 题`,
		forcedSubmit: '提前/自动交卷',
		currentMistakes: '当前错题',
		target: '目标时长',
		session: 'Session',
		lapSync: '各 Part 用时',
		mistakesByPart: '每个 Part 错了几题',
		rootCauseTags: '为什么错（可选）',
		dataEntryTitle: '对答案，填错题数',
		dataEntryDescription: '对照答案，把每个 Part 错了几题填进来即可。错因和笔记都是可选的。',
		actual: '实际耗时',
		baseline: '基准耗时',
		doneCount: (count, total) => `${count}/${total} 完成`,
		thisRun: (value) => `本次 ${value}`,
		lastRun: (value) => `上次 ${value}`,
		awaitingCapture: '还没做',
		strictListeningMode: '听力计时模式',
		strictReadingMode: '阅读 · 限时 75 分钟',
		restartStrictAttempt: '重新计时',
		startStrictAttempt: '开始计时',
		runningNow: '进行中',
		readingLapSequence: '正在做哪个 Part',
		timeoutFrozen: '75 分钟到了，计时已停止。',
		forcedEnded: '已交卷！还有几题没来得及做？',
		pendingSubmitBody: '估分会按考场上「全部涂满」来算：没做的题 4 选 1，平均能蒙对 1/4。全部做完就填 0。',
		unfinishedPlaceholder: '0',
		saveSubmitData: '确认',
		timeProfilingLocked: '当前无分段时间数据',
		timeProfilingLockedBody: '听力 session 不生成阅读分段数据。切换到阅读节点后，才能查看 Part 5/6/7 与基准时间的偏差。',
		noReadingLapData: '尚无阅读打点数据',
		noReadingLapDataBody: '先启动阅读计时，并在各阶段结束时记录时间，这个面板才会显示具体的时间分布。',
		strictPacingPlaceholder: '记录阅读计时后，这里会显示各阶段的用时数据。',
		readingTimeProfilingDesc: '对比各段实际耗时与基准。',
		delta: '差值',
		mistakeTrend: '错题诊断',
		weaknessRadar: '短板雷达',
		rootCauseFrequency: '错因频次',
		rootCauseFrequencyDesc: '高频错因标签。',
		saveDebugToUnlock: '至少保存一份复盘记录后，才会显示错因分析。',
		listeningSeries: '听力',
		readingSeries: '阅读',
		errorRate: '错误率',
		dataVaultTitle: '备份与同步',
		dataVaultDescription: '所有记录只保存在这个浏览器里。定期下载一份备份，或同步到手机，换设备也不怕丢。',
		exportTitle: '下载备份文件',
		exportBody: '把所有练习记录、成绩和生词保存成一个文件，换电脑或清理浏览器前建议先下载一份。',
		exportAction: '下载',
		exportVocabularyTitle: '导出生词表',
		exportVocabularyBody: '只导出单词本身，每行一个，可以直接导入其他背单词 App。',
		exportVocabularyAction: '导出词表',
		exportVocabularyEmpty: '当前没有可导出的生词。',
		exportVocabularySuccess: (count) => `生词表导出成功，共 ${count} 个单词。`,
		copyAiPromptTitle: '让 AI 帮你补全生词释义',
		copyAiPromptBody: '复制一段提示词，粘贴给 ChatGPT、Claude 等 AI；再把 AI 的回复复制下来，用上方「从剪贴板导入」即可合并释义，复习记录不会丢。',
		copyAiPromptAction: '复制提示词',
		copyAiPromptSuccess: '提示词已复制！请直接粘贴给 ChatGPT、Claude 等大模型',
		exportSuccess: '数据成功导出。',
		exportFailure: '导出失败，请重试。',
		importTitle: '从备份文件恢复',
		importBody: '选择之前下载的备份文件（.json）。会替换当前记录，替换前自动留一份备份。',
		importAction: '选择文件',
		importSuccess: '恢复成功。',
		importFailure: '导入失败，文件格式有误。',
		resetTitle: '清空所有记录',
		resetBody: '清空练习记录、成绩、生词和考试日期。清空前会自动备份，可在上方「自动备份」里找回。',
		resetAction: '清空数据',
		resetSuccess: '数据已清空。',
		resetDialogTitle: '确认清空所有数据？',
		resetDialogBody: '将删除所有练习记录、历史成绩、生词和考试日期。清空前会自动留一份备份，之后可以在「自动备份」里恢复。',
		confirmResetAction: '确认清空',
		cancelAction: '取消',
		lastOperation: '状态日志',
		syncTitle: '同步到另一台设备',
		syncBody: '生成一个链接或二维码，在手机或另一台电脑上打开，就能把记录搬过去。',
		syncAction: '生成链接',
		syncIncludeVocabularyLabel: '同步时包含生词表',
		syncIncludeVocabularyHint: '一起带上生词（不含释义）。生词很多时可以关掉，让链接短一些。',
		syncCopyAction: '复制链接',
		syncQrAction: '显示二维码',
		syncCopiedAction: '已复制',
		syncSuccess: '同步链接已生成。',
		syncFailure: '同步链接生成失败，请重试。',
		syncCopied: '同步链接已复制。',
		syncTooLarge: '当前数据量较大，不适合生成同步链接。建议改用 JSON 备份文件。',
		syncDetectedTitle: '检测到同步链接',
		syncDetectedBody: '这个链接里带着另一台设备的练习记录，确认后会导入到这台设备。',
		syncDialogWarning: '导入后会覆盖当前设备中的训练进度、历史成绩和考试日期。',
		syncImportAction: '导入同步数据',
		syncDismissAction: '忽略链接',
		syncPreviewVersion: '数据版本',
		syncPreviewSessions: '套题数',
		syncPreviewHistory: '历史成绩',
		syncPreviewVocabulary: '生词数量',
		syncPreviewActive: '当前套题',
		syncPreviewExportedAt: '导出时间',
		syncPreviewSize: '链接长度',
		syncQrTitle: '同步二维码',
		syncQrBody: '用另一台设备扫码打开该链接，再确认导入即可。',
		importDialogTitle: '确认用这份备份替换当前记录？',
		importDialogBody: '备份文件读取成功。确认后会用它替换这台设备上的记录。',
		importDialogWarning: '当前的练习记录、成绩和考试日期会被替换；替换前会自动留一份备份。',
		importConfirmAction: '确认导入',
		importPreviewFile: '文件名',
		importPreviewSource: '导入来源',
		importPreviewExamDate: '考试日期',
		importPreviewSize: '文件大小',
		unfinishedTrackerTitle: '未完成',
		unfinishedTotal: '未完成总题数',
		unfinishedSessions: '受影响 session',
		unfinishedCurrent: '当前 session',
		unfinishedLatest: '最近遗漏',
		unfinishedQueue: '待处理队列',
		unfinishedNone: '当前没有未完成题',
		unfinishedNoneDescription: '当前没有待补录题目。',
		openSession: '打开 session',
		affectedCount: (count) => `${count} 个 session`,
		unfinishedChartHint: '点击折线节点可直接跳转到对应 session。',
		scoreRawCorrect: '答对题数',
		scoreMistakes: '错题数',
		scoreAccuracy: '正确率',
		scoreListeningLabel: '听力',
		scoreReadingLabel: '阅读',
		scoreTotalLabel: '总分',
		missionGoalTitle: '考试日期与题量',
		missionGoalDesc: '告诉我们你哪天考试、打算做几套题。',
		sprintLength: '计划做几套',
		sprintLengthDesc: '每套 = 听力 + 阅读',
		saveConfig: '保存目标',
	},
	en: {
		appName: 'Cheese TOEIC Tracker',
		examCountdownLabel: 'Exam date',
		status: 'Status',
		sprintDay: (day) => `Sprint Day ${day.toString().padStart(2, '0')}`,
		saveDiagnostics: 'Save Review',
		yes: 'Yes',
		no: 'No',
		unfinished: (count) => `${count} unfinished`,
		forcedSubmit: 'Early/Auto Submit',
		currentMistakes: 'Current Mistakes',
		target: 'Target',
		session: 'Session',
		lapSync: 'Time per Part',
		mistakesByPart: 'How many wrong per Part',
		rootCauseTags: 'Why you missed them (optional)',
		dataEntryTitle: 'Check answers, enter mistakes',
		dataEntryDescription: 'Using the answer key, enter how many you got wrong in each Part. Reasons and notes are optional.',
		actual: 'Actual',
		baseline: 'Baseline',
		doneCount: (count, total) => `${count}/${total} done`,
		thisRun: (value) => `This run ${value}`,
		lastRun: (value) => `Last run ${value}`,
		awaitingCapture: 'Not yet',
		strictListeningMode: 'Listening Timer Mode',
		strictReadingMode: 'Reading · 75-minute limit',
		restartStrictAttempt: 'Restart Timer',
		startStrictAttempt: 'Start Timer',
		runningNow: 'Running Now',
		readingLapSequence: 'Which Part you are on',
		timeoutFrozen: '75 minutes are up; the timer has stopped.',
		forcedEnded: 'Submitted! How many questions did you not get to?',
		pendingSubmitBody: 'The estimate assumes you fill in every blank on test day, so about 1 in 4 unanswered questions counts as right. Enter 0 if you finished.',
		unfinishedPlaceholder: '0',
		saveSubmitData: 'Confirm',
		timeProfilingLocked: 'No segment timing data yet',
		timeProfilingLockedBody: 'Listening sessions do not generate reading segment timing. Switch to a reading node to inspect Part 5/6/7 against the benchmark.',
		noReadingLapData: 'No Reading Lap Data Yet',
		noReadingLapDataBody: 'Start the reading timer and record each segment to display the time distribution here.',
		strictPacingPlaceholder: 'Segment timing data will appear here after a reading attempt is recorded.',
		readingTimeProfilingDesc: 'Compare actual time with the benchmark.',
		delta: 'Delta',
		mistakeTrend: 'Incorrect Answer Diagnostics',
		weaknessRadar: 'Weakness Radar',
		rootCauseFrequency: 'Root Cause Frequency',
		rootCauseFrequencyDesc: 'Most frequent root-cause tags.',
		saveDebugToUnlock: 'Save at least one review form to activate root-cause analytics.',
		listeningSeries: 'Listening',
		readingSeries: 'Reading',
		errorRate: 'Error Rate',
		dataVaultTitle: 'Backup & Sync',
		dataVaultDescription: 'Everything is stored only in this browser. Download a backup now and then, or sync to your phone, so nothing gets lost.',
		exportTitle: 'Export Snapshot',
		exportBody: 'Generate a versioned .json snapshot of progress, timer records, score history, and the exam date for safer future upgrades.',
		exportAction: 'Export',
		exportVocabularyTitle: 'Export Vocabulary List',
		exportVocabularyBody: 'Export words only, one per line, so they can be imported into other vocabulary apps.',
		exportVocabularyAction: 'Export words',
		exportVocabularyEmpty: 'No vocabulary words available to export.',
		exportVocabularySuccess: (count) => `Vocabulary list exported (${count} words).`,
		copyAiPromptTitle: 'Copy AI Optimization Prompt',
		copyAiPromptBody: 'Pack your vocabulary words and copy a specialized AI prompt to clipboard. Let AI re-evaluate definitions contextually for TOEIC, then just re-import the optimized JSON file right above.',
		copyAiPromptAction: 'Copy Prompt',
		copyAiPromptSuccess: 'Prompt copied! Now paste into ChatGPT or Claude!',
		exportSuccess: 'Data exported successfully.',
		exportFailure: 'Export failed. Please try again.',
		importTitle: 'Import Snapshot',
		importBody: 'Load a .json file. The app will try compatible snapshot import first, then overwrite current data.',
		importAction: 'Import',
		importSuccess: 'Data imported successfully.',
		importFailure: 'Import failed. Invalid file format.',
		resetTitle: 'Factory Reset',
		resetBody: 'Clear sprint records, score history, and the exam date. This action is irreversible.',
		resetAction: 'Reset',
		resetSuccess: 'Data reset successfully.',
		resetDialogTitle: 'Confirm data wipe?',
		resetDialogBody: 'This will irreversibly delete your 20-day sprint progress, score history, and exam date, then restore the default state. Export a backup before proceeding.',
		confirmResetAction: 'Confirm wipe',
		cancelAction: 'Cancel',
		lastOperation: 'Status log',
		syncTitle: 'Create Sync Link',
		syncBody: 'Compress the current snapshot into the URL hash so it can be copied into chat, notes, or opened from a QR code on another device.',
		syncAction: 'Create link',
		syncIncludeVocabularyLabel: 'Include vocabulary list in sync',
		syncIncludeVocabularyHint: 'When enabled, vocabulary tracking metadata is embedded in the sync link (word, encounter count, source tags; definitions excluded). Disable for shorter links.',
		syncCopyAction: 'Copy link',
		syncQrAction: 'Show QR',
		syncCopiedAction: 'Copied',
		syncSuccess: 'Sync link created.',
		syncFailure: 'Failed to create sync link. Please try again.',
		syncCopied: 'Sync link copied.',
		syncTooLarge: 'The current dataset is too large for a practical sync link. Use the JSON backup instead.',
		syncDetectedTitle: 'Sync link detected',
		syncDetectedBody: 'This page contains a compressed snapshot in the address. Import it to restore the same data on this device.',
		syncDialogWarning: 'Importing will overwrite the current device progress, score history, and exam date.',
		syncImportAction: 'Import sync data',
		syncDismissAction: 'Dismiss',
		syncPreviewVersion: 'Snapshot version',
		syncPreviewSessions: 'Sessions',
		syncPreviewHistory: 'Score history',
		syncPreviewVocabulary: 'Vocabulary',
		syncPreviewActive: 'Active session',
		syncPreviewExportedAt: 'Exported at',
		syncPreviewSize: 'Link length',
		syncQrTitle: 'Sync QR Code',
		syncQrBody: 'Scan this code on another device, open the link, then confirm import.',
		importDialogTitle: 'Import this snapshot?',
		importDialogBody: 'The file was parsed successfully. Confirm to overwrite this device with the imported data.',
		importDialogWarning: 'This replaces the current sprint progress, score history, and exam date. Export a backup first if needed.',
		importConfirmAction: 'Confirm import',
		importPreviewFile: 'File name',
		importPreviewSource: 'Source',
		importPreviewExamDate: 'Exam date',
		importPreviewSize: 'File size',
		unfinishedTrackerTitle: 'Unfinished',
		unfinishedTotal: 'Total unfinished',
		unfinishedSessions: 'Affected sessions',
		unfinishedCurrent: 'Current session',
		unfinishedLatest: 'Latest backlog',
		unfinishedQueue: 'Recovery queue',
		unfinishedNone: 'No unfinished questions',
		unfinishedNoneDescription: 'No unfinished items right now.',
		openSession: 'Open session',
		affectedCount: (count) => `${count} sessions`,
		unfinishedChartHint: 'Click any point on the line to jump to that session.',
		scoreRawCorrect: 'Correct answers',
		scoreMistakes: 'Incorrect Answers',
		scoreAccuracy: 'Accuracy',
		scoreListeningLabel: 'Listening',
		scoreReadingLabel: 'Reading',
		scoreTotalLabel: 'Total',
		missionGoalTitle: 'Mission Goal',
		missionGoalDesc: 'Configure your exam date and sprint set length.',
		sprintLength: 'Sprint Length',
		sprintLengthDesc: 'Number of full test sets to complete.',
		saveConfig: 'Save Goal',
	},
};

export function getCopy(locale: Locale) {
	return copy[locale];
}

export function translateStatus(locale: Locale, status: SessionStatus) {
	return statusLabels[locale][status];
}

export function translatePart(locale: Locale, part: MistakeKey) {
	return partLabels[locale][part];
}

export function translateReason(locale: Locale, reason: string) {
	return reasonLabels[locale][reason as keyof typeof reasonLabels.zh] ?? reason;
}

export function formatSessionTitle(locale: Locale, session: SessionRecord) {
	return locale === 'zh'
		? `${session.type === 'L' ? '听力' : '阅读'}第 ${session.setNumber} 套`
		: session.title;
}
