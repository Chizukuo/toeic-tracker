export type SessionType = "L" | "R";

export type SessionStatus = "not-started" | "in-progress" | "debugged";

export type ListeningPartKey = "Part 1" | "Part 2" | "Part 3" | "Part 4";
export type ReadingPartKey = "Part 5" | "Part 6" | "Part 7 Single" | "Part 7 Multiple";
export type MistakeKey = ListeningPartKey | ReadingPartKey;

export type ReadingLapKey = ReadingPartKey;

export type TimerSummary = {
	totalElapsedMs: number;
	forcedSubmit: boolean;
	timedOut: boolean;
	unfinishedQuestions: number;
	completedAt: string;
};

export type SessionBlueprint = {
	id: string;
	sprintDay: number;
	type: SessionType;
	setNumber: number;
	label: string;
	title: string;
	targetMinutes: number;
};

export type SessionRecord = SessionBlueprint & {
	status: SessionStatus;
	mistakes: Partial<Record<MistakeKey, number>>;
	reasons: string[];
	readingLapTimes: Partial<Record<ReadingLapKey, number>>;
	timerSummary?: TimerSummary;
	updatedAt?: string;
};

type ScoreCheckpoint = {
	raw: number;
	scaled: number;
};

export const LISTENING_PARTS: ListeningPartKey[] = [
	"Part 1",
	"Part 2",
	"Part 3",
	"Part 4",
];

export const READING_PARTS: ReadingPartKey[] = [
	"Part 5",
	"Part 6",
	"Part 7 Single",
	"Part 7 Multiple",
];

export const LISTENING_TAGS = [
	"词汇盲区",
	"连读丢包",
	"口音宕机",
	"预判超时",
] as const;

export const READING_TAGS = [
	"语法结构误判",
	"同义词未命中",
	"跨表检索超时",
	"长难句解析卡顿",
] as const;

export const READING_LAP_SEGMENTS = [
	{ key: "Part 5", shortLabel: "P5", baselineMinutes: 10 },
	{ key: "Part 6", shortLabel: "P6", baselineMinutes: 8 },
	{ key: "Part 7 Single", shortLabel: "P7-S", baselineMinutes: 25 },
	{ key: "Part 7 Multiple", shortLabel: "P7-M", baselineMinutes: 32 },
] as const;

export const PART_QUESTION_COUNTS: Record<MistakeKey, number> = {
	"Part 1": 6,
	"Part 2": 25,
	"Part 3": 39,
	"Part 4": 30,
	"Part 5": 30,
	"Part 6": 16,
	"Part 7 Single": 29,
	"Part 7 Multiple": 25,
};

const LISTENING_SCORE_CHECKPOINTS: ScoreCheckpoint[] = [
	{ raw: 0, scaled: 5 },
	{ raw: 5, scaled: 25 },
	{ raw: 10, scaled: 50 },
	{ raw: 15, scaled: 75 },
	{ raw: 20, scaled: 105 },
	{ raw: 25, scaled: 135 },
	{ raw: 30, scaled: 170 },
	{ raw: 35, scaled: 205 },
	{ raw: 40, scaled: 240 },
	{ raw: 45, scaled: 270 },
	{ raw: 50, scaled: 300 },
	{ raw: 55, scaled: 330 },
	{ raw: 60, scaled: 355 },
	{ raw: 65, scaled: 380 },
	{ raw: 70, scaled: 405 },
	{ raw: 75, scaled: 425 },
	{ raw: 80, scaled: 445 },
	{ raw: 85, scaled: 460 },
	{ raw: 90, scaled: 475 },
	{ raw: 95, scaled: 490 },
	{ raw: 100, scaled: 495 },
];

const READING_SCORE_CHECKPOINTS: ScoreCheckpoint[] = [
	{ raw: 0, scaled: 5 },
	{ raw: 5, scaled: 15 },
	{ raw: 10, scaled: 35 },
	{ raw: 15, scaled: 55 },
	{ raw: 20, scaled: 80 },
	{ raw: 25, scaled: 110 },
	{ raw: 30, scaled: 140 },
	{ raw: 35, scaled: 170 },
	{ raw: 40, scaled: 200 },
	{ raw: 45, scaled: 230 },
	{ raw: 50, scaled: 260 },
	{ raw: 55, scaled: 290 },
	{ raw: 60, scaled: 320 },
	{ raw: 65, scaled: 350 },
	{ raw: 70, scaled: 380 },
	{ raw: 75, scaled: 405 },
	{ raw: 80, scaled: 430 },
	{ raw: 85, scaled: 450 },
	{ raw: 90, scaled: 470 },
	{ raw: 95, scaled: 485 },
	{ raw: 100, scaled: 495 },
];

export const TOEIC_SPRINT_SESSIONS: SessionBlueprint[] = Array.from(
	{ length: 10 },
	(_, index) => {
		const setNumber = index + 1;
		const listeningDay = index * 2 + 1;
		const readingDay = index * 2 + 2;

		return [
			{
				id: `L${setNumber}`,
				sprintDay: listeningDay,
				type: "L" as const,
				setNumber,
				label: `L${setNumber}`,
				title: `Listening Set ${setNumber}`,
				targetMinutes: 45,
			},
			{
				id: `R${setNumber}`,
				sprintDay: readingDay,
				type: "R" as const,
				setNumber,
				label: `R${setNumber}`,
				title: `Reading Set ${setNumber}`,
				targetMinutes: 75,
			},
		];
	}
).flat();

export function createInitialSessions(): SessionRecord[] {
	return TOEIC_SPRINT_SESSIONS.map((session) => ({
		...session,
		status: "not-started",
		mistakes: {},
		reasons: [],
		readingLapTimes: {},
	}));
}

export function getTargetDurationMs(type: SessionType) {
	return (type === "L" ? 45 : 75) * 60 * 1000;
}

export function getPartsForType(type: SessionType) {
	return type === "L" ? LISTENING_PARTS : READING_PARTS;
}

export function getQuestionCountForType(type: SessionType) {
	return getPartsForType(type).reduce(
		(sum, part) => sum + PART_QUESTION_COUNTS[part],
		0
	);
}

export function getReasonsForType(type: SessionType) {
	return type === "L" ? LISTENING_TAGS : READING_TAGS;
}

export function formatClock(ms: number) {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes.toString().padStart(2, "0")}:${seconds
		.toString()
		.padStart(2, "0")}`;
}

export function formatMinutes(ms?: number) {
	if (ms === undefined) {
		return "--";
	}

	return `${(ms / 60000).toFixed(1)}m`;
}

export function sumMistakes(record: SessionRecord) {
	return Object.values(record.mistakes).reduce((sum, value) => sum + (value ?? 0), 0);
}

export function getCorrectAnswers(record: SessionRecord) {
	const totalQuestions = getQuestionCountForType(record.type);
	const mistakeCount = getPartsForType(record.type).reduce(
		(sum, part) => sum + (record.mistakes[part] ?? 0),
		0
	);

	return Math.min(totalQuestions, Math.max(totalQuestions - mistakeCount, 0));
}

export function hasRecordedSessionData(record: SessionRecord) {
	return (
		record.status !== "not-started" ||
		sumMistakes(record) > 0 ||
		Boolean(record.timerSummary) ||
		Object.keys(record.readingLapTimes).length > 0 ||
		record.reasons.length > 0
	);
}

export function estimateToeicScaledScore(rawCorrect: number, type: SessionType) {
	const totalQuestions = getQuestionCountForType(type);
	const safeRaw = Math.min(totalQuestions, Math.max(rawCorrect, 0));
	const checkpoints = type === "L" ? LISTENING_SCORE_CHECKPOINTS : READING_SCORE_CHECKPOINTS;

	if (safeRaw <= checkpoints[0].raw) {
		return checkpoints[0].scaled;
	}

	for (let index = 1; index < checkpoints.length; index += 1) {
		const previous = checkpoints[index - 1];
		const current = checkpoints[index];

		if (safeRaw <= current.raw) {
			const progress = (safeRaw - previous.raw) / (current.raw - previous.raw);
			const scaled = previous.scaled + progress * (current.scaled - previous.scaled);
			return Math.min(495, Math.max(5, Math.round(scaled / 5) * 5));
		}
	}

	return 495;
}

export function sumReadingLapTimes(record: SessionRecord) {
	return READING_LAP_SEGMENTS.reduce(
		(sum, segment) => sum + (record.readingLapTimes[segment.key] ?? 0),
		0
	);
}

export function getSessionStatusLabel(status: SessionStatus) {
	switch (status) {
		case "debugged":
			return "已 Debug";
		case "in-progress":
			return "进行中";
		default:
			return "未开始";
	}
}

export function getLatestReasonHotspot(sessions: SessionRecord[]) {
	const counts = new Map<string, number>();

	for (const session of sessions) {
		for (const reason of session.reasons) {
			counts.set(reason, (counts.get(reason) ?? 0) + 1);
		}
	}

	const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
	return top ? `${top[0]} x${top[1]}` : "尚无归因数据";
}

export function getWorstPartLabel(sessions: SessionRecord[]) {
	const completed = sessions.filter((session) => session.status !== "not-started");
	if (completed.length === 0) {
		return "尚无数据";
	}

	let worstLabel = "尚无数据";
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
			worstLabel = `${part} ${(rate * 100).toFixed(1)}%`;
		}
	}

	return worstLabel;
}

export function mergeSessionWithDefaults(
	incoming: Partial<SessionRecord> & Pick<SessionRecord, "id">
) {
	const blueprint = TOEIC_SPRINT_SESSIONS.find((session) => session.id === incoming.id);
	if (!blueprint) {
		throw new Error(`Unknown TOEIC session id: ${incoming.id}`);
	}

	return {
		...createInitialSessions().find((session) => session.id === incoming.id),
		...blueprint,
		...incoming,
		mistakes: incoming.mistakes ?? {},
		reasons: incoming.reasons ?? [],
		readingLapTimes: incoming.readingLapTimes ?? {},
	} as SessionRecord;
}
