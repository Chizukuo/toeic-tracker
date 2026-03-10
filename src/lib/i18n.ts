import {
	LISTENING_PARTS,
	PART_QUESTION_COUNTS,
	READING_PARTS,
	getPartsForType,
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
		'词汇盲区': '词汇盲区',
		'连读丢包': '连读丢包',
		'口音宕机': '口音宕机',
		'预判超时': '预判超时',
		'语法结构误判': '语法结构误判',
		'同义词未命中': '同义词未命中',
		'跨表检索超时': '跨表检索超时',
		'长难句解析卡顿': '长难句解析卡顿',
	},
	en: {
		'词汇盲区': 'Vocabulary Blind Spot',
		'连读丢包': 'Connected Speech Loss',
		'口音宕机': 'Accent Breakdown',
		'预判超时': 'Prediction Timeout',
		'语法结构误判': 'Grammar Misread',
		'同义词未命中': 'Synonym Miss',
		'跨表检索超时': 'Cross-Reference Timeout',
		'长难句解析卡顿': 'Long-Sentence Parsing Lag',
	},
} as const;

const statusLabels: Record<Locale, Record<SessionStatus, string>> = {
	zh: {
		'not-started': '未开始',
		'in-progress': '进行中',
		debugged: '已完成复盘',
	},
	en: {
		'not-started': 'Not Started',
		'in-progress': 'In Progress',
		debugged: 'Reviewed',
	},
};

type Copy = {
	appName: string;
	heroTitle: string;
	heroBody: string;
	examCountdownTitle: string;
	examCountdownDescription: string;
	examCountdownLabel: string;
	examCountdownDays: string;
	examCountdownHours: string;
	examCountdownReady: string;
	currentSession: string;
	status: string;
	hotRootCause: string;
	worstPart: string;
	mostRepeatedTag: string;
	averageErrorRateBottleneck: string;
	pressureTape: string;
	lapRace: string;
	sprintDay: (day: number) => string;
	activeSessionDescription: (day: number, type: 'L' | 'R') => string;
	summaryDebugged: string;
	summaryInProgress: string;
	summaryTimeout: string;
	summaryMistakes: string;
	summaryDebuggedHelper: string;
	summaryInProgressHelper: string;
	summaryTimeoutHelper: string;
	summaryMistakesHelper: string;
	sprintProtocol: string;
	sprintProtocolDesc: string;
	protocolListeningTitle: string;
	protocolListeningBody: string;
	protocolReadingTitle: string;
	protocolReadingBody: string;
	protocolTimeoutTitle: string;
	protocolTimeoutBody: string;
	protocolPersistTitle: string;
	protocolPersistBody: string;
	dashboardTitle: string;
	dashboardDescription: string;
	latestCapture: string;
	noReasonData: string;
	noPartData: string;
	saveDiagnostics: string;
	markDebugged: string;
	yes: string;
	no: string;
	listeningDiagnosis: string;
	readingDiagnosis: string;
	officialSprintTime: string;
	liveTotalInForm: string;
	noTimerSummary: string;
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
	currentCheckpoint: (label: string) => string;
	allLapsCompleted: string;
	doneCount: (count: number, total: number) => string;
	thisRun: (value: string) => string;
	lastRun: (value: string) => string;
	awaitingCapture: string;
	strictListeningMode: string;
	strictReadingMode: string;
	listeningTimerBody: string;
	readingTimerBody: string;
	restartStrictAttempt: string;
	startStrictAttempt: string;
	forceSubmit: string;
	runningNow: string;
	savedAttempt: string;
	timedOutSaved: string;
	savedReadingTime: (value: string) => string;
	noListeningAttempt: string;
	noReadingAttempt: string;
	lapAction: (label: string) => string;
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
	readingTimeProfiling: string;
	readingTimeProfilingDesc: string;
	delta: string;
	analyticsTitle: string;
	mistakeTrend: string;
	mistakeTrendDesc: string;
	weaknessRadar: string;
	weaknessRadarDesc: string;
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
	dataVaultNotes: string;
	dataVaultNoteExport: string;
	dataVaultNoteImport: string;
	dataVaultNoteReset: string;
	lastOperation: string;
	dataVaultIdle: string;
	languageLabel: string;
	unfinishedTrackerTitle: string;
	unfinishedTrackerDescription: string;
	unfinishedTotal: string;
	unfinishedSessions: string;
	unfinishedCurrent: string;
	unfinishedLatest: string;
	unfinishedQueue: string;
	unfinishedQueueDescription: string;
	unfinishedNone: string;
	unfinishedNoneDescription: string;
	openSession: string;
	affectedCount: (count: number) => string;
	unfinishedChartHint: string;
	scoreEstimatorTitle: string;
	scoreEstimatorDescription: string;
	scoreEstimatorNote: string;
	scoreModeListening: string;
	scoreModeReading: string;
	scoreModeTotal: string;
	scoreSelectListening: string;
	scoreSelectReading: string;
	scoreSelectPair: string;
	scoreScaled: string;
	scoreRawCorrect: string;
	scoreMistakes: string;
	scoreAccuracy: string;
	scoreListeningLabel: string;
	scoreReadingLabel: string;
	scoreTotalLabel: string;
	scoreUnavailable: string;
	scoreUnavailableBody: string;
};

const copy: Record<Locale, Copy> = {
	zh: {
		appName: 'Cheese-TOEIC-Tracker',
		heroTitle: '20 天 TOEIC 冲刺工具',
		heroBody: '集中管理进度、计时、复盘和估分。',
		examCountdownTitle: '考试倒计时',
		examCountdownDescription: '设定考试日期。',
		examCountdownLabel: '考试日期',
		examCountdownDays: '剩余天数',
		examCountdownHours: '总剩余小时',
		examCountdownReady: '今天就是考试日，去考场。',
		currentSession: '当前任务',
		status: '状态',
		hotRootCause: '高频错因',
		worstPart: '薄弱 Part',
		mostRepeatedTag: '出现频率最高的错因标签',
		averageErrorRateBottleneck: '平均错误率最高的模块',
		pressureTape: '45 分钟听力计时',
		lapRace: '75 分钟阅读分段计时',
		sprintDay: (day) => `冲刺 Day ${day.toString().padStart(2, '0')}`,
		activeSessionDescription: (day, type) => `Day ${day.toString().padStart(2, '0')} · ${type === 'L' ? '听力训练任务' : '阅读训练任务'}`,
		summaryDebugged: '已完成复盘',
		summaryInProgress: '进行中',
		summaryTimeout: '超时记录',
		summaryMistakes: '累计失分',
		summaryDebuggedHelper: '本套题已完成错题复盘',
		summaryInProgressHelper: '已开始但尚未完成复盘',
		summaryTimeoutHelper: '达到时限后自动提交的记录数',
		summaryMistakesHelper: '20 天计划内累计损失的题数，阅读未完成题也会计入',
		sprintProtocol: '训练规则',
		sprintProtocolDesc: '当前节点的计时规则。',
		protocolListeningTitle: '听力',
		protocolListeningBody: '听力训练固定 45 分钟倒计时，开始后按完整套题连续完成。',
		protocolReadingTitle: '阅读',
		protocolReadingBody: '阅读训练固定 75 分钟，按 Part 5、Part 6、Part 7 单篇、Part 7 多篇顺序记录分段时间。',
		protocolTimeoutTitle: '超时',
		protocolTimeoutBody: '达到时限后会停止当前计时，并要求录入未完成题数量。',
		protocolPersistTitle: '持久化',
		protocolPersistBody: '所有 session 记录、计时结果、错因标签和图表数据都会通过本地持久化保留。',
		dashboardTitle: '计划',
		dashboardDescription: '点击任一节点，切换到对应套题。',
		latestCapture: '最近记录',
		noReasonData: '尚无归因数据',
		noPartData: '尚无数据',
		saveDiagnostics: '保存复盘记录',
		markDebugged: '并标记为已完成复盘',
		yes: '是',
		no: '否',
		listeningDiagnosis: '听力复盘',
		readingDiagnosis: '阅读复盘',
		officialSprintTime: '目标训练时长',
		liveTotalInForm: '当前表单中的错题总数',
		noTimerSummary: '尚无计时摘要',
		unfinished: (count) => `未完成 ${count} 题`,
		forcedSubmit: '自动提交',
		currentMistakes: '当前错题',
		target: '目标时长',
		session: 'Session',
		lapSync: '分段时间同步',
		mistakesByPart: '按 Part 录入错题',
		rootCauseTags: '错因标签',
		dataEntryTitle: '错题录入与复盘',
		dataEntryDescription: '录入错题、标签并保存。',
		actual: '实际耗时',
		baseline: '基准耗时',
		currentCheckpoint: (label) => `当前打点：${label}`,
		allLapsCompleted: '全部 lap 已完成',
		doneCount: (count, total) => `${count}/${total} 完成`,
		thisRun: (value) => `本次 ${value}`,
		lastRun: (value) => `上次 ${value}`,
		awaitingCapture: '等待打点',
		strictListeningMode: '听力计时模式',
		strictReadingMode: '阅读分段计时模式',
		listeningTimerBody: '启动后开始 45 分钟连续计时，用于记录整套听力训练耗时。',
		readingTimerBody: '启动后开始 75 分钟连续计时，并在每个阅读阶段结束时记录分段时间。',
		restartStrictAttempt: '重新开始本次计时',
		startStrictAttempt: '开始计时',
		forceSubmit: '结束并提交',
		runningNow: '进行中',
		savedAttempt: '重新开始会覆盖当前套题已记录的计时数据。',
		timedOutSaved: '该套训练曾在达到时限后自动提交。',
		savedReadingTime: (value) => `已记录阅读总耗时 ${value}`,
		noListeningAttempt: '尚未记录本套听力计时结果',
		noReadingAttempt: '尚未记录本套阅读计时结果',
		lapAction: (label) => `记录 ${label}`,
		readingLapSequence: '阅读分段记录',
		timeoutFrozen: '75 分钟已结束，当前计时已停止。',
		forcedEnded: '本次阅读训练已自动提交。',
		pendingSubmitBody: '保存本次记录前，需要先填写未完成题数量；未填写前不会写入本地数据。',
		unfinishedPlaceholder: '未完成题数',
		saveSubmitData: '保存提交记录',
		timeProfilingLocked: '当前无分段时间数据',
		timeProfilingLockedBody: '听力 session 不生成阅读分段数据。切换到阅读节点后，才能查看 Part 5/6/7 与基准时间的偏差。',
		noReadingLapData: '尚无阅读打点数据',
		noReadingLapDataBody: '先启动阅读计时，并在各阶段结束时记录时间，这个面板才会显示具体的时间分布。',
		strictPacingPlaceholder: '记录阅读计时后，这里会显示各阶段的用时数据。',
		readingTimeProfiling: '阅读耗时剖面',
		readingTimeProfilingDesc: '对比各段实际耗时与基准。',
		delta: '差值',
		analyticsTitle: '分析',
		mistakeTrend: '失分趋势',
		mistakeTrendDesc: '10 套听力与阅读的失分变化，阅读未完成题会计入。',
		weaknessRadar: '短板雷达',
		weaknessRadarDesc: '各 Part 错误率。',
		rootCauseFrequency: '错因频次',
		rootCauseFrequencyDesc: '高频错因标签。',
		saveDebugToUnlock: '至少保存一份复盘记录后，才会显示错因分析。',
		listeningSeries: '听力',
		readingSeries: '阅读',
		errorRate: '错误率',
		dataVaultTitle: '数据',
		dataVaultDescription: '导出版本化快照，兼容导入旧数据，并可重置本地训练数据、历史成绩与考试日期。',
		exportTitle: '导出数据快照',
		exportBody: '生成带版本信息的 .json 快照，包含任务进度、时间记录、历史成绩与考试日期，便于后续升级恢复。',
		exportAction: '导出备份',
		exportSuccess: '数据成功导出。',
		exportFailure: '导出失败，请重试。',
		importTitle: '导入数据快照',
		importBody: '选择已有的 .json 文件。系统会优先按快照版本兼容导入，当前数据将被覆盖。',
		importAction: '导入数据',
		importSuccess: '快照导入成功。',
		importFailure: '导入失败，文件格式有误。',
		resetTitle: '重置系统',
		resetBody: '清空任务记录、历史成绩与考试日期，此操作不可逆。',
		resetAction: '清空数据',
		resetSuccess: '数据已清空。',
		resetDialogTitle: '确认清空所有数据？',
		resetDialogBody: '这将会彻底删除您的 20 天冲刺记录、历史成绩与考试日期，并恢复默认状态。建议在重置前先导出备份。',
		confirmResetAction: '确认清空',
		cancelAction: '取消',
		dataVaultNotes: '功能说明',
		dataVaultNoteExport: '• 导出：生成包含全部训练数据的 JSON 快照',
		dataVaultNoteImport: '• 导入：加载已有的快照并覆盖当前环境数据',
		dataVaultNoteReset: '• 重置：一键清空进度还原初始状态',
		lastOperation: '状态日志',
		dataVaultIdle: '系统空闲中。',
		languageLabel: '语言',
		unfinishedTrackerTitle: '未完成',
		unfinishedTrackerDescription: '查看未完成题并跳转处理。',
		unfinishedTotal: '未完成总题数',
		unfinishedSessions: '受影响 session',
		unfinishedCurrent: '当前 session',
		unfinishedLatest: '最近遗漏',
		unfinishedQueue: '待处理队列',
		unfinishedQueueDescription: '按顺序列出仍需补录的 session。',
		unfinishedNone: '当前没有未完成题',
		unfinishedNoneDescription: '当前没有待补录题目。',
		openSession: '打开 session',
		affectedCount: (count) => `${count} 个 session`,
		unfinishedChartHint: '点击折线节点可直接跳转到对应 session。',
		scoreEstimatorTitle: 'PEASEA 估分',
		scoreEstimatorDescription: '查看听力、阅读和总分估算。',
		scoreEstimatorNote: '用于观察趋势，不等同于官方成绩。',
		scoreModeListening: '听力估分',
		scoreModeReading: '阅读估分',
		scoreModeTotal: '总分估算',
		scoreSelectListening: '选择听力 session',
		scoreSelectReading: '选择阅读 session',
		scoreSelectPair: '选择套次组合',
		scoreScaled: '估算分数',
		scoreRawCorrect: '答对题数',
		scoreMistakes: '失分题数',
		scoreAccuracy: '正确率',
		scoreListeningLabel: '听力',
		scoreReadingLabel: '阅读',
		scoreTotalLabel: '总分',
		scoreUnavailable: '当前还不能估分',
		scoreUnavailableBody: '先完成计时或保存错题数据，再进行估分会更准确。',
	},
	en: {
		appName: 'Cheese-TOEIC-Tracker',
		heroTitle: '20-day TOEIC sprint tool',
		heroBody: 'Track progress, timing, review, and score estimates in one place.',
		examCountdownTitle: 'Exam Countdown',
		examCountdownDescription: 'Set the exam date.',
		examCountdownLabel: 'Exam date',
		examCountdownDays: 'Days left',
		examCountdownHours: 'Total hours left',
		examCountdownReady: 'Exam day is here. Time to go.',
		currentSession: 'Current Session',
		status: 'Status',
		hotRootCause: 'Top Root Cause',
		worstPart: 'Worst Part',
		mostRepeatedTag: 'Most frequent root-cause tag',
		averageErrorRateBottleneck: 'Highest average error-rate module',
		pressureTape: '45-minute listening timer',
		lapRace: '75-minute segmented reading timer',
		sprintDay: (day) => `Sprint Day ${day.toString().padStart(2, '0')}`,
		activeSessionDescription: (day, type) => `Day ${day.toString().padStart(2, '0')} · ${type === 'L' ? 'Listening practice session' : 'Reading practice session'}`,
		summaryDebugged: 'Reviewed',
		summaryInProgress: 'In Progress',
		summaryTimeout: 'Timed Records',
		summaryMistakes: 'Total Loss',
		summaryDebuggedHelper: 'Review completed for this set',
		summaryInProgressHelper: 'Started but not fully reviewed',
		summaryTimeoutHelper: 'Runs auto-submitted at the time limit',
		summaryMistakesHelper: 'Total lost-question load across the sprint, including unfinished reading items',
		sprintProtocol: 'Training Rules',
		sprintProtocolDesc: 'Timing rules for the current session.',
		protocolListeningTitle: 'Listening',
		protocolListeningBody: 'Listening runs on a fixed 45-minute timer and is intended to be completed in one continuous attempt.',
		protocolReadingTitle: 'Reading',
		protocolReadingBody: 'Reading runs on a fixed 75-minute timer with segment checkpoints for Part 5, Part 6, Part 7 Single, and Part 7 Multiple.',
		protocolTimeoutTitle: 'Timeout',
		protocolTimeoutBody: 'When the time limit is reached, the current run stops and unfinished questions must be logged.',
		protocolPersistTitle: 'Persistence',
		protocolPersistBody: 'All session records, timer results, root-cause tags, and chart data are stored locally and survive refresh.',
		dashboardTitle: 'Plan',
		dashboardDescription: 'Select any node to switch to that set.',
		latestCapture: 'Latest Capture',
		noReasonData: 'No root-cause data yet',
		noPartData: 'No data yet',
		saveDiagnostics: 'Save Review',
		markDebugged: 'and Mark Reviewed',
		yes: 'Yes',
		no: 'No',
		listeningDiagnosis: 'Listening review',
		readingDiagnosis: 'Reading review',
		officialSprintTime: 'Target duration',
		liveTotalInForm: 'Current total mistakes in this form',
		noTimerSummary: 'No timer summary yet',
		unfinished: (count) => `${count} unfinished`,
		forcedSubmit: 'Auto Submit',
		currentMistakes: 'Current Mistakes',
		target: 'Target',
		session: 'Session',
		lapSync: 'Segment Sync',
		mistakesByPart: 'Mistakes by Part',
		rootCauseTags: 'Root Cause Tags',
		dataEntryTitle: 'Mistake Entry & Review',
		dataEntryDescription: 'Record mistakes, tags, and save.',
		actual: 'Actual',
		baseline: 'Baseline',
		currentCheckpoint: (label) => `Current checkpoint: ${label}`,
		allLapsCompleted: 'All laps completed',
		doneCount: (count, total) => `${count}/${total} done`,
		thisRun: (value) => `This run ${value}`,
		lastRun: (value) => `Last run ${value}`,
		awaitingCapture: 'Awaiting capture',
		strictListeningMode: 'Listening Timer Mode',
		strictReadingMode: 'Segmented Reading Timer',
		listeningTimerBody: 'Start a continuous 45-minute listening timer to record the full attempt.',
		readingTimerBody: 'Start a continuous 75-minute reading timer and capture each segment when it ends.',
		restartStrictAttempt: 'Restart Timer',
		startStrictAttempt: 'Start Timer',
		forceSubmit: 'Finish and Submit',
		runningNow: 'Running Now',
		savedAttempt: 'Restarting will overwrite the current timer data for this set.',
		timedOutSaved: 'This set was previously auto-submitted at the time limit.',
		savedReadingTime: (value) => `Recorded reading total: ${value}`,
		noListeningAttempt: 'No listening timer result recorded yet',
		noReadingAttempt: 'No reading timer result recorded yet',
		lapAction: (label) => `Record ${label}`,
		readingLapSequence: 'Reading Segments',
		timeoutFrozen: 'The 75-minute limit has been reached and timing has stopped.',
		forcedEnded: 'This reading attempt was auto-submitted.',
		pendingSubmitBody: 'Before this run can be saved, enter the number of unfinished questions.',
		unfinishedPlaceholder: 'Unfinished questions',
		saveSubmitData: 'Save submission',
		timeProfilingLocked: 'No segment timing data yet',
		timeProfilingLockedBody: 'Listening sessions do not generate reading segment timing. Switch to a reading node to inspect Part 5/6/7 against the benchmark.',
		noReadingLapData: 'No Reading Lap Data Yet',
		noReadingLapDataBody: 'Start the reading timer and record each segment to display the time distribution here.',
		strictPacingPlaceholder: 'Segment timing data will appear here after a reading attempt is recorded.',
		readingTimeProfiling: 'Reading Time Profiling',
		readingTimeProfilingDesc: 'Compare actual time with the benchmark.',
		delta: 'Delta',
		analyticsTitle: 'Analysis',
		mistakeTrend: 'Loss Trend',
		mistakeTrendDesc: 'Lost-question change across the 10 listening and 10 reading sets, including unfinished reading items.',
		weaknessRadar: 'Weakness Radar',
		weaknessRadarDesc: 'Error rate by part.',
		rootCauseFrequency: 'Root Cause Frequency',
		rootCauseFrequencyDesc: 'Most frequent root-cause tags.',
		saveDebugToUnlock: 'Save at least one review form to activate root-cause analytics.',
		listeningSeries: 'Listening',
		readingSeries: 'Reading',
		errorRate: 'Error Rate',
		dataVaultTitle: 'Data',
		dataVaultDescription: 'Export versioned snapshots, import older data compatibly, or reset local training data, score history, and the exam date.',
		exportTitle: 'Export Snapshot',
		exportBody: 'Generate a versioned .json snapshot of progress, timer records, score history, and the exam date for safer future upgrades.',
		exportAction: 'Export',
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
		dataVaultNotes: 'Notes',
		dataVaultNoteExport: '• Export: Save full sprint history to a readable JSON file',
		dataVaultNoteImport: '• Import: Restore progress by overwriting current setup',
		dataVaultNoteReset: '• Reset: Wipe all local data and return to initial state',
		lastOperation: 'Status log',
		dataVaultIdle: 'System idle.',
		languageLabel: 'Language',
		unfinishedTrackerTitle: 'Unfinished',
		unfinishedTrackerDescription: 'Review unfinished questions and jump back to the set.',
		unfinishedTotal: 'Total unfinished',
		unfinishedSessions: 'Affected sessions',
		unfinishedCurrent: 'Current session',
		unfinishedLatest: 'Latest backlog',
		unfinishedQueue: 'Recovery queue',
		unfinishedQueueDescription: 'Sessions that still need unfinished items logged.',
		unfinishedNone: 'No unfinished questions',
		unfinishedNoneDescription: 'No unfinished items right now.',
		openSession: 'Open session',
		affectedCount: (count) => `${count} sessions`,
		unfinishedChartHint: 'Click any point on the line to jump to that session.',
		scoreEstimatorTitle: 'PEASEA Estimator',
		scoreEstimatorDescription: 'View listening, reading, and total estimates.',
		scoreEstimatorNote: 'Directional only, not an official score.',
		scoreModeListening: 'Listening',
		scoreModeReading: 'Reading',
		scoreModeTotal: 'Total',
		scoreSelectListening: 'Choose listening session',
		scoreSelectReading: 'Choose reading session',
		scoreSelectPair: 'Choose sprint pair',
		scoreScaled: 'Estimated score',
		scoreRawCorrect: 'Correct answers',
		scoreMistakes: 'Lost Questions',
		scoreAccuracy: 'Accuracy',
		scoreListeningLabel: 'Listening',
		scoreReadingLabel: 'Reading',
		scoreTotalLabel: 'Total',
		scoreUnavailable: 'No score estimate yet',
		scoreUnavailableBody: 'Finish a timed run or save mistake data first for a meaningful estimate.',
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

export function formatHotspot(locale: Locale, sessions: SessionRecord[]) {
	const counts = new Map<string, number>();

	for (const session of sessions) {
		for (const reason of session.reasons) {
			counts.set(reason, (counts.get(reason) ?? 0) + 1);
		}
	}

	const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
	if (!top) {
		return getCopy(locale).noReasonData;
	}

	return `${translateReason(locale, top[0])} x${top[1]}`;
}

export function formatWorstPart(locale: Locale, sessions: SessionRecord[]) {
	const completed = sessions.filter((session) => session.status !== 'not-started');
	if (completed.length === 0) {
		return getCopy(locale).noPartData;
	}

	let worstPart: MistakeKey | null = null;
	let worstRate = -1;

	for (const part of [...LISTENING_PARTS, ...READING_PARTS]) {
		const matchingSessions = completed.filter((session) =>
			getPartsForType(session.type).includes(part as never)
		);

		if (matchingSessions.length === 0) {
			continue;
		}

		const totalMistakes = matchingSessions.reduce(
			(sum, session) => sum + (session.mistakes[part] ?? 0),
			0
		);
		const totalQuestions = PART_QUESTION_COUNTS[part] * matchingSessions.length;
		const rate = totalQuestions > 0 ? totalMistakes / totalQuestions : 0;

		if (rate > worstRate) {
			worstRate = rate;
			worstPart = part;
		}
	}

	if (!worstPart) {
		return getCopy(locale).noPartData;
	}

	return `${translatePart(locale, worstPart)} ${(worstRate * 100).toFixed(1)}%`;
}