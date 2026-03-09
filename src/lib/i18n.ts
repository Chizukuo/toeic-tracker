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
		debugged: '已 Debug',
	},
	en: {
		'not-started': 'Not Started',
		'in-progress': 'In Progress',
		debugged: 'Debugged',
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
		heroTitle: '把 20 天冲刺收进一个清晰面板，直接看进度、时间和估分变化。',
		heroBody: '20 个 session 按听力与阅读交替推进，计时、错题、未完成题和估分趋势都会持续保存。',
		examCountdownTitle: '考试倒计时',
		examCountdownDescription: '设定考试日，随时查看剩余时间。',
		examCountdownLabel: '考试日期',
		examCountdownDays: '剩余天数',
		examCountdownHours: '总剩余小时',
		examCountdownReady: '今天就是考试日，去考场。',
		currentSession: '当前任务',
		status: '状态',
		hotRootCause: '高频错因',
		worstPart: '最弱 Part',
		mostRepeatedTag: '最常重复的 Debug 标签',
		averageErrorRateBottleneck: '平均错误率最高的瓶颈模块',
		pressureTape: '45 分钟高压带',
		lapRace: '75 分钟分段赛',
		sprintDay: (day) => `冲刺 Day ${day.toString().padStart(2, '0')}`,
		activeSessionDescription: (day, type) => `Day ${day.toString().padStart(2, '0')} · ${type === 'L' ? '听力高压模拟' : '阅读节奏拆解'}`,
		summaryDebugged: '已 Debug',
		summaryInProgress: '进行中',
		summaryTimeout: '超时交卷',
		summaryMistakes: '累计错题',
		summaryDebuggedHelper: '诊断闭环已完成',
		summaryInProgressHelper: '已启动但尚未复盘',
		summaryTimeoutHelper: '75 分钟被系统硬锁',
		summaryMistakesHelper: '20 天全量错误总和',
		sprintProtocol: '冲刺协议',
		sprintProtocolDesc: '这个 tracker 强制执行的硬规则。',
		protocolListeningTitle: '听力',
		protocolListeningBody: '固定 45 分钟红区倒计时。没有暂停键，也没有缓冲区。',
		protocolReadingTitle: '阅读',
		protocolReadingBody: '固定 75 分钟，按 Part 5、6、7 单篇、7 多篇顺序打点。',
		protocolTimeoutTitle: '超时',
		protocolTimeoutBody: '75 分钟耗尽后计时冻结，并强制录入未完成题数。',
		protocolPersistTitle: '持久化',
		protocolPersistBody: '所有 session 记录、计时结果、Debug 标签和图表数据都通过 Zustand persist 保存。',
		dashboardTitle: '冲刺总览',
		dashboardDescription: '20 个节点按 L1 / R1 / L2 / R2 ... / L10 / R10 排列。点击任意节点，整个工作台会立刻切换到该套题的计时、录入和分析视角。',
		latestCapture: '最近一次记录',
		noReasonData: '尚无归因数据',
		noPartData: '尚无数据',
		saveDiagnostics: '保存诊断',
		markDebugged: '并标记为已 Debug',
		yes: '是',
		no: '否',
		listeningDiagnosis: '听力诊断',
		readingDiagnosis: '阅读诊断',
		officialSprintTime: '官方目标时长',
		liveTotalInForm: '当前表单内的实时总错题',
		noTimerSummary: '尚无计时摘要',
		unfinished: (count) => `未完成 ${count} 题`,
		forcedSubmit: '强制交卷',
		currentMistakes: '当前错题',
		target: '目标时长',
		session: 'Session',
		lapSync: 'Lap 联动',
		mistakesByPart: '按 Part 录入错题',
		rootCauseTags: '错因标签',
		dataEntryTitle: '数据录入与 Debug',
		dataEntryDescription: '先按 Part 录入错题，再圈定真正的失误模式，最后把这一套题推进到已 Debug 状态。',
		actual: '实际耗时',
		baseline: '基准耗时',
		currentCheckpoint: (label) => `当前打点：${label}`,
		allLapsCompleted: '全部 lap 已完成',
		doneCount: (count, total) => `${count}/${total} 完成`,
		thisRun: (value) => `本次 ${value}`,
		lastRun: (value) => `上次 ${value}`,
		awaitingCapture: '等待打点',
		strictListeningMode: '严格听力模式',
		strictReadingMode: '严格阅读打点引擎',
		listeningTimerBody: '45 分钟无暂停模拟。开始后就进入红区，直到录音结束。',
		readingTimerBody: '75 分钟倒计时，必须在每个阅读模块结束时精准点击打点。',
		restartStrictAttempt: '重新开始本次模拟',
		startStrictAttempt: '开始严格模拟',
		forceSubmit: '强制交卷',
		runningNow: '进行中',
		savedAttempt: '重新开始会覆盖当前套题的 pacing 数据。',
		timedOutSaved: '该套曾在 75 分钟耗尽后被系统硬锁。',
		savedReadingTime: (value) => `${value} 的阅读耗时已记录`,
		noListeningAttempt: '尚未记录本套听力计时结果',
		noReadingAttempt: '尚未记录本套阅读计时结果',
		lapAction: (label) => `打点 ${label}`,
		readingLapSequence: '阅读 Lap 序列',
		timeoutFrozen: '75 分钟已耗尽，系统已冻结计时器。',
		forcedEnded: '本次阅读已被强制交卷。',
		pendingSubmitBody: '在保存本次记录前，必须录入尚未完成的题数。未录入前，本次阅读 attempt 不会写入持久化数据。',
		unfinishedPlaceholder: '未完成题数',
		saveSubmitData: '保存交卷数据',
		timeProfilingLocked: '耗时分析已锁定',
		timeProfilingLockedBody: '听力 session 不生成 lap 耗时数据。切换到任意 R 节点后，才能检查 Part 5/6/7 相对基准的偏移。',
		noReadingLapData: '尚无阅读打点数据',
		noReadingLapDataBody: '先启动阅读计时器，并在正确的 checkpoint 点击 lap，这个面板才会暴露你的超时来源。',
		strictPacingPlaceholder: '一旦记录到阅读 attempt，这里就会显示严格 pacing 数据。',
		readingTimeProfiling: '阅读耗时剖面',
		readingTimeProfilingDesc: '把阅读各模块的实际耗时和基准预算放在同一张图上，哪一段拖慢全局，一眼就能看出来。',
		delta: '差值',
		analyticsTitle: '综合分析',
		mistakeTrend: '错题趋势',
		mistakeTrendDesc: '看 10 套听力与 10 套阅读的总错题是否真的在下降，而不是只凭体感判断自己有没有进步。',
		weaknessRadar: '短板雷达',
		weaknessRadarDesc: '按 Part 聚合错误率。尖刺越外扩，说明这个模块越值得优先修正和复盘。',
		rootCauseFrequency: '错因频次',
		rootCauseFrequencyDesc: '统计所有已完成 session 中最常出现的 Debug 标签，告诉你下一轮复盘精力最该投到哪里。',
		saveDebugToUnlock: '先保存至少一份 Debug 表单，才能激活错因分析。',
		listeningSeries: '听力',
		readingSeries: '阅读',
		errorRate: '错误率',
		dataVaultTitle: '数据管理',
		dataVaultDescription: '导出、导入数据快照以备份或迁移训练进度。重置操作将清空所有数据。',
		exportTitle: '导出数据快照',
		exportBody: '生成 .json 本地备份，包含所有任务进度与时间记录。',
		exportAction: '导出备份',
		exportSuccess: '数据成功导出。',
		exportFailure: '导出失败，请重试。',
		importTitle: '导入数据快照',
		importBody: '选择已有的 .json 文件，当前数据将被覆盖。',
		importAction: '导入数据',
		importSuccess: '快照导入成功。',
		importFailure: '导入失败，文件格式有误。',
		resetTitle: '重置系统',
		resetBody: '清空所有任务记录与进度数据，此操作不可逆。',
		resetAction: '清空数据',
		resetSuccess: '数据已清空。',
		resetDialogTitle: '确认清空所有数据？',
		resetDialogBody: '这将会彻底删除您的20天冲刺记录，建议在重置前先导出备份。',
		confirmResetAction: '确认清空',
		cancelAction: '取消',
		dataVaultNotes: '功能说明',
		dataVaultNoteExport: '• 导出：生成包含全部训练数据的 JSON 快照',
		dataVaultNoteImport: '• 导入：加载已有的快照并覆盖当前环境数据',
		dataVaultNoteReset: '• 重置：一键清空进度还原初始状态',
		lastOperation: '状态日志',
		dataVaultIdle: '系统空闲中。',
		languageLabel: '语言',
		unfinishedTrackerTitle: '未完成追踪',
		unfinishedTrackerDescription: '集中查看超时或强制交卷后遗留的未完成题，快速定位还没补齐的 session。',
		unfinishedTotal: '未完成总题数',
		unfinishedSessions: '受影响 session',
		unfinishedCurrent: '当前 session',
		unfinishedLatest: '最近遗漏',
		unfinishedQueue: '待补题队列',
		unfinishedQueueDescription: '按冲刺顺序列出所有仍有未完成题的 session，可直接跳转。',
		unfinishedNone: '当前没有未完成题',
		unfinishedNoneDescription: '所有已记录的 session 都已完整交卷，可以继续按当前节奏推进。',
		openSession: '打开 session',
		affectedCount: (count) => `${count} 个 session`,
		unfinishedChartHint: '点击折线节点可直接跳转到对应 session。',
		scoreEstimatorTitle: 'TOEIC 估分系统',
		scoreEstimatorDescription: '按常见 TOEIC 5-495 换算曲线估算听力、阅读与总分，可单独看单科，也可按同套次合并。',
		scoreEstimatorNote: '估分基于 raw correct 到 scaled score 的常见换算区间，适合冲刺期追踪趋势，不等同于官方成绩单。',
		scoreModeListening: '听力估分',
		scoreModeReading: '阅读估分',
		scoreModeTotal: '总分估算',
		scoreSelectListening: '选择听力 session',
		scoreSelectReading: '选择阅读 session',
		scoreSelectPair: '选择套次组合',
		scoreScaled: '估算分数',
		scoreRawCorrect: '答对题数',
		scoreMistakes: '错题数',
		scoreAccuracy: '正确率',
		scoreListeningLabel: '听力',
		scoreReadingLabel: '阅读',
		scoreTotalLabel: '总分',
		scoreUnavailable: '当前还不能估分',
		scoreUnavailableBody: '先完成计时或保存错题数据，再进行估分会更准确。',
	},
	en: {
		appName: 'Cheese-TOEIC-Tracker',
		heroTitle: 'Put the 20-day TOEIC sprint on one clean surface for pace, progress, and score trend.',
		heroBody: 'All 20 sessions alternate between listening and reading, with timers, mistakes, unfinished counts, and score trends saved automatically.',
		examCountdownTitle: 'Exam Countdown',
		examCountdownDescription: 'Set the test date and keep the remaining time visible.',
		examCountdownLabel: 'Exam date',
		examCountdownDays: 'Days left',
		examCountdownHours: 'Total hours left',
		examCountdownReady: 'Exam day is here. Time to go.',
		currentSession: 'Current Session',
		status: 'Status',
		hotRootCause: 'Hot Root Cause',
		worstPart: 'Worst Part',
		mostRepeatedTag: 'Most repeated debug tag',
		averageErrorRateBottleneck: 'Highest average error-rate bottleneck',
		pressureTape: '45m pressure tape',
		lapRace: '75m lap race',
		sprintDay: (day) => `Sprint Day ${day.toString().padStart(2, '0')}`,
		activeSessionDescription: (day, type) => `Day ${day.toString().padStart(2, '0')} · ${type === 'L' ? 'Listening pressure simulation' : 'Reading pacing breakdown'}`,
		summaryDebugged: 'Debugged',
		summaryInProgress: 'In Progress',
		summaryTimeout: 'Timed Out',
		summaryMistakes: 'Total Mistakes',
		summaryDebuggedHelper: 'Closed-loop review completed',
		summaryInProgressHelper: 'Started but not reviewed yet',
		summaryTimeoutHelper: 'Hard-locked at 75 minutes',
		summaryMistakesHelper: 'Total error load across the sprint',
		sprintProtocol: 'Sprint Protocol',
		sprintProtocolDesc: 'Hard rules enforced by this tracker.',
		protocolListeningTitle: 'Listening',
		protocolListeningBody: 'Fixed 45-minute red-zone countdown. No pause button, no comfort blanket.',
		protocolReadingTitle: 'Reading',
		protocolReadingBody: 'Fixed 75 minutes with lap checkpoints for Part 5, 6, 7 single, and 7 multiple.',
		protocolTimeoutTitle: 'Timeout',
		protocolTimeoutBody: 'When time runs out, the timer freezes and unfinished questions must be logged.',
		protocolPersistTitle: 'Persistence',
		protocolPersistBody: 'All session records, timer results, debug tags, and chart datasets survive refresh through Zustand persist.',
		dashboardTitle: 'Sprint Dashboard',
		dashboardDescription: 'The 20 nodes follow strict L1 / R1 / L2 / R2 ... / L10 / R10 order. Select any node and the whole workbench pivots to that set\'s timer, debug panel, and analytics.',
		latestCapture: 'Latest Capture',
		noReasonData: 'No root-cause data yet',
		noPartData: 'No data yet',
		saveDiagnostics: 'Save Diagnostics',
		markDebugged: 'and Mark Debugged',
		yes: 'Yes',
		no: 'No',
		listeningDiagnosis: 'Listening diagnosis',
		readingDiagnosis: 'Reading diagnosis',
		officialSprintTime: 'Official sprint time',
		liveTotalInForm: 'Live total inside this form',
		noTimerSummary: 'No timer summary yet',
		unfinished: (count) => `Unfinished ${count}`,
		forcedSubmit: 'Forced Submit',
		currentMistakes: 'Current Mistakes',
		target: 'Target',
		session: 'Session',
		lapSync: 'Lap Sync',
		mistakesByPart: 'Mistakes by Part',
		rootCauseTags: 'Root Cause Tags',
		dataEntryTitle: 'Data Entry & Debug',
		dataEntryDescription: 'Record part-level misses, tag the real failure mode, and move the set into a proper debug-complete state.',
		actual: 'Actual',
		baseline: 'Baseline',
		currentCheckpoint: (label) => `Current checkpoint: ${label}`,
		allLapsCompleted: 'All laps completed',
		doneCount: (count, total) => `${count}/${total} done`,
		thisRun: (value) => `This run ${value}`,
		lastRun: (value) => `Last run ${value}`,
		awaitingCapture: 'Awaiting capture',
		strictListeningMode: 'Strict Listening Mode',
		strictReadingMode: 'Strict Reading Lap Engine',
		listeningTimerBody: 'A 45-minute no-pause simulation. Start it and stay in the red zone until the tape ends.',
		readingTimerBody: 'A 75-minute countdown with mandatory lap capture at each reading checkpoint.',
		restartStrictAttempt: 'Restart Strict Attempt',
		startStrictAttempt: 'Start Strict Attempt',
		forceSubmit: 'Force Submit',
		runningNow: 'Running Now',
		savedAttempt: 'Restarting will overwrite the current pacing capture for this set.',
		timedOutSaved: 'This set previously hard-locked after the 75-minute cap.',
		savedReadingTime: (value) => `${value} pacing has been captured`,
		noListeningAttempt: 'No listening timer result recorded yet',
		noReadingAttempt: 'No reading timer result recorded yet',
		lapAction: (label) => `Lap ${label}`,
		readingLapSequence: 'Reading Lap Sequence',
		timeoutFrozen: 'The 75-minute limit has been reached and the timer is now frozen.',
		forcedEnded: 'This reading attempt was force-submitted.',
		pendingSubmitBody: 'Before this attempt can be saved, you must enter how many questions were left unfinished.',
		unfinishedPlaceholder: 'Unfinished questions',
		saveSubmitData: 'Save submission data',
		timeProfilingLocked: 'Time Profiling Locked',
		timeProfilingLockedBody: 'Listening sessions do not produce lap pacing data. Switch to an R node to inspect Part 5/6/7 drift against the benchmark.',
		noReadingLapData: 'No Reading Lap Data Yet',
		noReadingLapDataBody: 'Start the reading timer and hit each checkpoint precisely; then this panel will show where your pacing budget is leaking.',
		strictPacingPlaceholder: 'Strict pacing data will appear here once a reading attempt is captured.',
		readingTimeProfiling: 'Reading Time Profiling',
		readingTimeProfilingDesc: 'Actual time versus benchmark budget. The overrun becomes visible immediately, module by module.',
		delta: 'Delta',
		analyticsTitle: 'Analytics',
		mistakeTrend: 'Mistake Trend',
		mistakeTrendDesc: 'Track whether total misses are truly trending down across the 10 listening and 10 reading sets, not just feeling better subjectively.',
		weaknessRadar: 'Weakness Radar',
		weaknessRadarDesc: 'Aggregated part error-rate polygon. The farther a spike stretches, the more urgently that part needs repair.',
		rootCauseFrequency: 'Root Cause Frequency',
		rootCauseFrequencyDesc: 'The most repeated debug tags across all completed sessions. This is where your next review block should start.',
		saveDebugToUnlock: 'Save at least one debug form to activate root-cause analytics.',
		listeningSeries: 'Listening',
		readingSeries: 'Reading',
		errorRate: 'Error Rate',
		dataVaultTitle: 'Data Management',
		dataVaultDescription: 'Export, import, or reset your current sprint data. Resetting will clear all session progress.',
		exportTitle: 'Export Snapshot',
		exportBody: 'Generate a .json backup of your progress and timer records.',
		exportAction: 'Export',
		exportSuccess: 'Data exported successfully.',
		exportFailure: 'Export failed. Please try again.',
		importTitle: 'Import Snapshot',
		importBody: 'Load a .json file. Current data will be overwritten.',
		importAction: 'Import',
		importSuccess: 'Data imported successfully.',
		importFailure: 'Import failed. Invalid file format.',
		resetTitle: 'Factory Reset',
		resetBody: 'Clear all records entirely. This action is irreversible.',
		resetAction: 'Reset',
		resetSuccess: 'Data reset successfully.',
		resetDialogTitle: 'Confirm data wipe?',
		resetDialogBody: 'This will irreversibly delete your 20-day sprint progress. Export a backup before proceeding.',
		confirmResetAction: 'Confirm wipe',
		cancelAction: 'Cancel',
		dataVaultNotes: 'Notes',
		dataVaultNoteExport: '• Export: Save full sprint history to a readable JSON file',
		dataVaultNoteImport: '• Import: Restore progress by overwriting current setup',
		dataVaultNoteReset: '• Reset: Wipe all local data and return to initial state',
		lastOperation: 'Status log',
		dataVaultIdle: 'System idle.',
		languageLabel: 'Language',
		unfinishedTrackerTitle: 'Unfinished Tracker',
		unfinishedTrackerDescription: 'Track questions left unfinished after timeouts or forced submits, and jump straight back to the affected set.',
		unfinishedTotal: 'Total unfinished',
		unfinishedSessions: 'Affected sessions',
		unfinishedCurrent: 'Current session',
		unfinishedLatest: 'Latest backlog',
		unfinishedQueue: 'Recovery queue',
		unfinishedQueueDescription: 'All sessions with unfinished questions, listed in sprint order for quick follow-up.',
		unfinishedNone: 'No unfinished questions',
		unfinishedNoneDescription: 'Every recorded session has been submitted cleanly. Keep the current pace.',
		openSession: 'Open session',
		affectedCount: (count) => `${count} sessions`,
		unfinishedChartHint: 'Click any point on the line to jump to that session.',
		scoreEstimatorTitle: 'TOEIC Score Estimator',
		scoreEstimatorDescription: 'Estimate listening, reading, and combined totals with a 5-495 TOEIC-style conversion curve.',
		scoreEstimatorNote: 'This estimator uses a common raw-to-scaled TOEIC curve for sprint tracking. It is directional, not an official score report.',
		scoreModeListening: 'Listening',
		scoreModeReading: 'Reading',
		scoreModeTotal: 'Total',
		scoreSelectListening: 'Choose listening session',
		scoreSelectReading: 'Choose reading session',
		scoreSelectPair: 'Choose sprint pair',
		scoreScaled: 'Estimated score',
		scoreRawCorrect: 'Correct answers',
		scoreMistakes: 'Mistakes',
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