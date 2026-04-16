// ─── Vocabulary / Phrase Notebook ──────────────────────────────────────────

export type VocabularyEntry = {
	id: string;
	text: string;
	reading?: string;
	definition?: string;
	enDefinition?: string;
	partOfSpeech?: string;
	exampleSentence?: string;
	knockdownCount?: number;
	comebackCount?: number;
	lastKnockdownAt?: string;
	lastComebackAt?: string;
	sessionIds: string[];
	encounterCount: number;
	tags: string[];
	createdAt: string;
	updatedAt: string;
};

// ─── Sprint Configuration ────────────────────────────────────────────────────

export type SprintConfig = {
	listeningCount: number;
	readingCount: number;
};

export const SPRINT_DEFAULT_CONFIG: SprintConfig = {
	listeningCount: 10,
	readingCount: 10,
};

// ─── Session Model ───────────────────────────────────────────────────────────

export type SessionType = "L" | "R";

export type SessionStatus = "not-started" | "in-progress" | "debugged";

export type ListeningPartKey = "Part 1" | "Part 2" | "Part 3" | "Part 4";
export type ReadingPartKey = "Part 5" | "Part 6" | "Part 7 Single" | "Part 7 Multiple";
export type MistakeKey = ListeningPartKey | ReadingPartKey;

export type ReadingLapKey = ReadingPartKey;

export type ReadingUnfinishedByPart = Partial<Record<ReadingPartKey, number>>;

export type UnfinishedByPartSource = "manual" | "inferred" | "fallback";

export type UnfinishedByPartMeta = {
	source: UnfinishedByPartSource;
	confidence: number;
};

export type TimerSummary = {
	totalElapsedMs: number;
	forcedSubmit: boolean;
	timedOut: boolean;
	unfinishedQuestions: number;
	resolvedUnfinished: boolean;
	unfinishedByPart?: ReadingUnfinishedByPart;
	unfinishedByPartMeta?: UnfinishedByPartMeta;
	overtimeElapsedMs?: number;
	completedAt: string;
};

export type TimerRuntimeState = {
	startedAt: string;
	lapStartedAt?: string;
	currentLapIndex: number;
	readingLapTimes: Partial<Record<ReadingLapKey, number>>;
	isOvertime?: boolean;
	overtimeStartedAt?: string;
	overtimeElapsedMs?: number;
	pendingSubmit?: {
		forcedSubmit: boolean;
		timedOut: boolean;
	};
	unfinishedQuestionsDraft?: string;
	unfinishedByPartDraft?: ReadingUnfinishedByPart;
	timeLeftMs?: number;
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
	overtimeMistakes?: Partial<Record<MistakeKey, number>>;
	reasons: string[];
	readingLapTimes: Partial<Record<ReadingLapKey, number>>;
	timerSummary?: TimerSummary;
	timerRuntime?: TimerRuntimeState;
	notes?: string;
	updatedAt?: string;
};

export type DataConfidenceLevel = "low" | "medium" | "high";

export type DataConfidenceIssue =
	| "timer-running"
	| "missing-timer"
	| "missing-review"
	| "unfinished-backlog"
	| "sparse-history";

export type DataConfidence = {
	level: DataConfidenceLevel;
	issues: DataConfidenceIssue[];
};

export type AnalyticsConfidence = DataConfidence & {
	recordedSessions: number;
	reviewedSessions: number;
	inProgressSessions: number;
	unfinishedSessions: number;
	timedOutSessions: number;
};

type ScoreCheckpoint = {
	raw: number;
	scaled: number;
};

type ScoreInterval = {
	min: number;
	max: number;
};

type SectionPartStat<TPart extends MistakeKey> = {
	part: TPart;
	questionCount: number;
	mistakes: number;
	errorRate: number;
	correct: number;
	shareOfLoss: number;
};

type SectionBiasProfile = {
	alpha: number;
	basicErrorRate: number;
	advancedErrorRate: number;
	anomalyGap: number;
	deltaRaw: number;
	penaltyRaw: number;
	anomalyDetected: boolean;
};

export type ToeicSectionEstimate = {
	available: boolean;
	type: SessionType;
	scoringMode: "strict" | "potential";
	rawCorrect: number;
	adjustedRawCorrect: number;
	scaled: number;
	interval: ScoreInterval;
	cefr: ToeicCefrLevel;
	sem: number;
	bias: SectionBiasProfile;
	partStats: SectionPartStat<MistakeKey>[];
	strongestPart?: MistakeKey;
	weakestPart?: MistakeKey;
	unfinishedPenalty: number;
	resolvedUnfinished: boolean;
	overtimeElapsedMs?: number;
	responsePattern: "normal" | "aberrant";
};

export type ToeicCombinedEstimate = {
	available: boolean;
	scoringMode: "strict" | "potential";
	listening?: ToeicSectionEstimate;
	reading?: ToeicSectionEstimate;
	total: number;
	interval: ScoreInterval;
	cefr: ToeicCefrLevel;
	rawCorrect: number;
	adjustedRawCorrect: number;
	totalMistakes: number;
	accuracy: number;
	sem: number;
};

export type ToeicCefrLevel = "Below A1" | "A1" | "A2" | "B1" | "B2" | "C1";

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

const LISTENING_PART_SET = new Set<MistakeKey>(LISTENING_PARTS);

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

export const PEASEA_ERROR_VECTOR_PARTS: readonly MistakeKey[] = [
	"Part 1",
	"Part 2",
	"Part 3",
	"Part 4",
	"Part 5",
	"Part 6",
	"Part 7 Single",
	"Part 7 Multiple",
];

const PEASEA_SECTION_CONFIG = {
	L: {
		anchors: [
			{ raw: 0, scaled: 5 },
			{ raw: 17, scaled: 5 },
			{ raw: 20, scaled: 20 },
			{ raw: 30, scaled: 80 },
			{ raw: 40, scaled: 150 },
			{ raw: 50, scaled: 225 },
			{ raw: 60, scaled: 295 },
			{ raw: 70, scaled: 355 },
			{ raw: 80, scaled: 420 },
			{ raw: 85, scaled: 445 },
			{ raw: 90, scaled: 480 },
			{ raw: 95, scaled: 495 },
			{ raw: 98, scaled: 495 },
			{ raw: 100, scaled: 495 },
		],
		basicParts: ["Part 1", "Part 2"] as const,
		advancedParts: ["Part 3", "Part 4"] as const,
		alpha: 0.12,
		sem: 25,
	},
	R: {
		anchors: [
			{ raw: 0, scaled: 5 },
			{ raw: 19, scaled: 5 },
			{ raw: 20, scaled: 5 },
			{ raw: 30, scaled: 55 },
			{ raw: 40, scaled: 115 },
			{ raw: 50, scaled: 175 },
			{ raw: 60, scaled: 250 },
			{ raw: 70, scaled: 300 },
			{ raw: 80, scaled: 360 },
			{ raw: 85, scaled: 395 },
			{ raw: 90, scaled: 435 },
			{ raw: 95, scaled: 470 },
			{ raw: 98, scaled: 485 },
			{ raw: 100, scaled: 495 },
		],
		basicParts: ["Part 5"] as const,
		advancedParts: ["Part 6", "Part 7 Single", "Part 7 Multiple"] as const,
		alpha: 0.18,
		sem: 25,
	},
} as const;

const CEFR_THRESHOLDS: Array<{
	level: Exclude<ToeicCefrLevel, "Below A1">;
	listening: number;
	reading: number;
	total: number;
}> = [
	{ level: "C1", listening: 490, reading: 455, total: 945 },
	{ level: "B2", listening: 400, reading: 385, total: 785 },
	{ level: "B1", listening: 275, reading: 275, total: 550 },
	{ level: "A2", listening: 110, reading: 115, total: 225 },
	{ level: "A1", listening: 60, reading: 60, total: 120 },
];

const SECTION_CEFR_THRESHOLDS: Array<{
	level: Exclude<ToeicCefrLevel, "Below A1">;
	minimum: number;
}> = [
	{ level: "C1", minimum: 455 },
	{ level: "B2", minimum: 385 },
	{ level: "B1", minimum: 275 },
	{ level: "A2", minimum: 115 },
	{ level: "A1", minimum: 60 },
];

/** Build the blueprint list for an arbitrary sprint shape. */
export function buildSprintBlueprints(config: SprintConfig = SPRINT_DEFAULT_CONFIG): SessionBlueprint[] {
	const maxCount = Math.max(config.listeningCount, config.readingCount);
	const sessions: SessionBlueprint[] = [];

	for (let i = 0; i < maxCount; i++) {
		const setNumber = i + 1;
		const listeningDay = i * 2 + 1;
		const readingDay = i * 2 + 2;

		if (i < config.listeningCount) {
			sessions.push({
				id: `L${setNumber}`,
				sprintDay: listeningDay,
				type: "L" as const,
				setNumber,
				label: `L${setNumber}`,
				title: `Listening Set ${setNumber}`,
				targetMinutes: 45,
			});
		}
		if (i < config.readingCount) {
			sessions.push({
				id: `R${setNumber}`,
				sprintDay: readingDay,
				type: "R" as const,
				setNumber,
				label: `R${setNumber}`,
				title: `Reading Set ${setNumber}`,
				targetMinutes: 75,
			});
		}
	}

	// Sort by sprint day so L/R alternate naturally
	return sessions.sort((a, b) => a.sprintDay - b.sprintDay);
}

/** Canonical default 10L+10R =20-session sprint (backward-compat reference). */
export const TOEIC_SPRINT_SESSIONS: SessionBlueprint[] = buildSprintBlueprints(SPRINT_DEFAULT_CONFIG);

function buildInitialSessions(blueprints: SessionBlueprint[]): SessionRecord[] {
	return blueprints.map((session) => ({
		...session,
		status: "not-started" as SessionStatus,
		mistakes: {},
		reasons: [],
		readingLapTimes: {},
	}));
}

const DEFAULT_INITIAL_SESSIONS = buildInitialSessions(TOEIC_SPRINT_SESSIONS);

const SESSION_BLUEPRINT_MAP = new Map(
	TOEIC_SPRINT_SESSIONS.map((session) => [session.id, session])
);

const INITIAL_SESSION_MAP = new Map(
	DEFAULT_INITIAL_SESSIONS.map((session) => [session.id, session])
);

export function createInitialSessions(config?: SprintConfig): SessionRecord[] {
	const blueprints = config ? buildSprintBlueprints(config) : TOEIC_SPRINT_SESSIONS;
	return buildInitialSessions(blueprints).map((session) => ({
		...session,
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

export function getSessionTypeForPart(part: MistakeKey): SessionType {
	return LISTENING_PART_SET.has(part) ? "L" : "R";
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

export function sumOvertimeMistakes(record: SessionRecord) {
	return Object.values(record.overtimeMistakes ?? {}).reduce(
		(sum, value) => sum + (value ?? 0),
		0
	);
}

export function hasResolvedUnfinished(record: SessionRecord) {
	if (record.type !== "R") {
		return true;
	}

	if ((record.timerSummary?.unfinishedQuestions ?? 0) <= 0) {
		return true;
	}

	return Boolean(record.timerSummary?.resolvedUnfinished);
}

export function getCorrectAnswers(
	record: SessionRecord,
	mode: "strict" | "potential" = "strict"
) {
	const totalQuestions = getQuestionCountForType(record.type);
	const mistakeSource = mode === "potential"
		? mergeMistakeSources(record)
		: record.mistakes;
	const mistakeCount = getPartsForType(record.type).reduce((sum, part) => {
		return sum + (mistakeSource[part] ?? 0);
	}, 0);
	const unfinishedPenalty = mode === "strict" ? getUnfinishedPenalty(record) : 0;

	return Math.min(totalQuestions, Math.max(totalQuestions - mistakeCount - unfinishedPenalty, 0));
}

export function getUnfinishedPenalty(record: SessionRecord) {
	if (record.type !== "R") {
		return 0;
	}

	return Math.max(record.timerSummary?.unfinishedQuestions ?? 0, 0);
}

export function getIncorrectAnswers(
	record: SessionRecord,
	mode: "strict" | "potential" = "strict"
) {
	const totalQuestions = getQuestionCountForType(record.type);
	const rawCorrect = getCorrectAnswers(record, mode);

	return Math.max(totalQuestions - rawCorrect, 0);
}

export function hasRecordedSessionData(record: SessionRecord) {
	return (
		record.status !== "not-started" ||
		sumMistakes(record) > 0 ||
		Boolean(record.timerSummary) ||
		Boolean(record.timerRuntime) ||
		Object.keys(record.readingLapTimes).length > 0 ||
		sumOvertimeMistakes(record) > 0 ||
		record.reasons.length > 0
	);
}

export function isSessionEstimateEligible(record: SessionRecord) {
	if (!hasRecordedSessionData(record)) {
		return false;
	}

	if (record.status === "debugged") {
		return true;
	}

	// In-progress attempts are estimatable only when the strict run timed out.
	return Boolean(record.timerSummary?.timedOut);
}

export function getSessionDataConfidence(record: SessionRecord): DataConfidence {
	const issues: DataConfidenceIssue[] = [];

	if (record.timerRuntime) {
		issues.push("timer-running");
	}

	if (!record.timerSummary) {
		issues.push("missing-timer");
	}

	if (record.status !== "debugged") {
		issues.push("missing-review");
	}

	if (record.type === "R" && getUnfinishedPenalty(record) > 0 && !hasResolvedUnfinished(record)) {
		issues.push("unfinished-backlog");
	}

	return {
		level: issues.includes("timer-running") || issues.includes("missing-timer")
			? "low"
			: issues.length > 0
				? "medium"
				: "high",
		issues,
	};
}

export function getCombinedDataConfidence(
	listeningRecord?: SessionRecord,
	readingRecord?: SessionRecord
): DataConfidence {
	const issues = new Set<DataConfidenceIssue>();
	const sectionLevels: DataConfidenceLevel[] = [];

	if (!listeningRecord || !readingRecord) {
		issues.add("sparse-history");
		return {
			level: "low",
			issues: [...issues],
		};
	}

	for (const record of [listeningRecord, readingRecord]) {
		const confidence = getSessionDataConfidence(record);
		sectionLevels.push(confidence.level);
		for (const issue of confidence.issues) {
			issues.add(issue);
		}
	}

	return {
		level: sectionLevels.includes("low")
			? "low"
			: sectionLevels.includes("medium")
				? "medium"
				: "high",
		issues: [...issues],
	};
}

export function getAnalyticsDataConfidence(sessions: SessionRecord[]): AnalyticsConfidence {
	let recordedSessions = 0;
	let reviewedSessions = 0;
	let inProgressSessions = 0;
	let unfinishedSessions = 0;
	let timedOutSessions = 0;
	const issues = new Set<DataConfidenceIssue>();

	for (const session of sessions) {
		if (hasRecordedSessionData(session)) {
			recordedSessions += 1;
		}

		if (session.status === "debugged") {
			reviewedSessions += 1;
		}

		if (session.status === "in-progress") {
			inProgressSessions += 1;
		}

		if (session.type === "R" && getUnfinishedPenalty(session) > 0 && !hasResolvedUnfinished(session)) {
			unfinishedSessions += 1;
		}

		if (session.timerSummary?.timedOut) {
			timedOutSessions += 1;
		}
	}

	if (recordedSessions < 4) {
		issues.add("sparse-history");
	}

	if (inProgressSessions > 0) {
		issues.add("missing-review");
	}

	if (unfinishedSessions > 0) {
		issues.add("unfinished-backlog");
	}

	const level: DataConfidenceLevel =
		recordedSessions < 2 || inProgressSessions > 0
			? "low"
			: unfinishedSessions > 0 || reviewedSessions < recordedSessions
				? "medium"
				: "high";

	return {
		level,
		issues: [...issues],
		recordedSessions,
		reviewedSessions,
		inProgressSessions,
		unfinishedSessions,
		timedOutSessions,
	};
}

export function estimateToeicScaledScore(rawCorrect: number, type: SessionType) {
	const safeRaw = clampRawScore(rawCorrect, type);
	return interpolateScaledScore(safeRaw, PEASEA_SECTION_CONFIG[type].anchors);
}

function clampRawScore(value: number, type: SessionType) {
	const totalQuestions = getQuestionCountForType(type);
	return Math.min(totalQuestions, Math.max(value, 0));
}

function clampConfidence(value: number | undefined) {
	if (typeof value !== "number" || Number.isNaN(value)) {
		return 0;
	}

	return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export function normalizeReadingPartDistribution(
	source?: Partial<Record<ReadingPartKey, number>>
): ReadingUnfinishedByPart {
	if (!source) {
		return {};
	}

	const normalized: ReadingUnfinishedByPart = {};

	for (const part of READING_PARTS) {
		const value = source[part];
		if (typeof value !== "number" || Number.isNaN(value)) {
			continue;
		}

		const safe = Math.max(0, Math.floor(value));
		if (safe > 0) {
			normalized[part] = safe;
		}
	}

	return normalized;
}

export function sumReadingPartDistribution(
	source?: Partial<Record<ReadingPartKey, number>>
) {
	const normalized = normalizeReadingPartDistribution(source);
	return READING_PARTS.reduce((sum, part) => sum + (normalized[part] ?? 0), 0);
}

function roundToNearestFive(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, Math.round(value / 5) * 5));
}

function getReadingFallbackOrder(record: SessionRecord): ReadingPartKey[] {
	const lapTimes = record.readingLapTimes ?? {};
	const currentLapIndex = record.timerRuntime?.currentLapIndex;

	return [...READING_PARTS].sort((left, right) => {
		const leftHasLap = lapTimes[left] !== undefined ? 1 : 0;
		const rightHasLap = lapTimes[right] !== undefined ? 1 : 0;
		if (leftHasLap !== rightHasLap) {
			return leftHasLap - rightHasLap;
		}

		if (typeof currentLapIndex === "number") {
			const leftIndex = READING_PARTS.indexOf(left);
			const rightIndex = READING_PARTS.indexOf(right);
			const leftAhead = leftIndex >= currentLapIndex ? 1 : 0;
			const rightAhead = rightIndex >= currentLapIndex ? 1 : 0;
			if (leftAhead !== rightAhead) {
				return rightAhead - leftAhead;
			}
		}

		return READING_PARTS.indexOf(right) - READING_PARTS.indexOf(left);
	});
}

function allocateReadingUnfinishedByWeights(
	unfinishedCount: number,
	weights: Record<ReadingPartKey, number>,
	capacities: Record<ReadingPartKey, number>
) {
	const distribution: ReadingUnfinishedByPart = {};
	let remaining = Math.max(0, Math.floor(unfinishedCount));

	if (remaining <= 0) {
		return { distribution, remaining: 0 };
	}

	const candidates = READING_PARTS.filter((part) => capacities[part] > 0);
	if (candidates.length === 0) {
		return { distribution, remaining };
	}

	const normalizedWeights = Object.fromEntries(
		READING_PARTS.map((part) => [part, Math.max(0.0001, weights[part] ?? 0)])
	) as Record<ReadingPartKey, number>;
	const totalWeight = candidates.reduce((sum, part) => sum + normalizedWeights[part], 0);
	const fractions: Array<{ part: ReadingPartKey; fraction: number }> = [];

	if (totalWeight > 0) {
		for (const part of candidates) {
			const raw = (remaining * normalizedWeights[part]) / totalWeight;
			const base = Math.min(capacities[part], Math.floor(raw));
			if (base > 0) {
				distribution[part] = base;
				remaining -= base;
			}

			fractions.push({
				part,
				fraction: raw - Math.floor(raw),
			});
		}

		fractions.sort((left, right) => {
			if (right.fraction !== left.fraction) {
				return right.fraction - left.fraction;
			}
			return normalizedWeights[right.part] - normalizedWeights[left.part];
		});

		while (remaining > 0) {
			const next = fractions.find((entry) => (distribution[entry.part] ?? 0) < capacities[entry.part]);
			if (!next) {
				break;
			}

			distribution[next.part] = (distribution[next.part] ?? 0) + 1;
			remaining -= 1;
		}
	}

	return { distribution, remaining };
}

export function inferReadingUnfinishedDistribution(
	record: SessionRecord,
	unfinishedCount: number
): {
	distribution: ReadingUnfinishedByPart;
	confidence: number;
	source: Exclude<UnfinishedByPartSource, "manual">;
} {
	const targetUnfinished = Math.max(0, Math.floor(unfinishedCount));
	if (record.type !== "R" || targetUnfinished <= 0) {
		return {
			distribution: {},
			confidence: 1,
			source: "fallback",
		};
	}

	const weights = Object.fromEntries(
		READING_PARTS.map((part) => [part, 1])
	) as Record<ReadingPartKey, number>;
	const currentLapIndex = record.timerRuntime?.currentLapIndex;
	const completedLapCount = READING_PARTS.reduce(
		(sum, part) => sum + (record.readingLapTimes[part] !== undefined ? 1 : 0),
		0
	);
	const hasSignal = completedLapCount > 0 || typeof currentLapIndex === "number";

	for (const part of READING_PARTS) {
		const hasLap = record.readingLapTimes[part] !== undefined;
		weights[part] += hasLap ? 0.05 : 2.8;
	}

	if (typeof currentLapIndex === "number") {
		for (let index = 0; index < READING_PARTS.length; index += 1) {
			const part = READING_PARTS[index];
			weights[part] += index >= currentLapIndex ? 1.8 : 0.05;
		}
	}

	if (!hasSignal) {
		const distribution: ReadingUnfinishedByPart = {};
		let remaining = targetUnfinished;

		for (const part of [...READING_PARTS].reverse()) {
			if (remaining <= 0) {
				break;
			}

			const capacity = Math.max(0, PART_QUESTION_COUNTS[part] - Math.max(0, record.mistakes[part] ?? 0));
			if (capacity <= 0) {
				continue;
			}

			const assigned = Math.min(capacity, remaining);
			distribution[part] = assigned;
			remaining -= assigned;
		}

		return {
			distribution,
			confidence: 0.25,
			source: "fallback",
		};
	}

	const capacities = Object.fromEntries(
		READING_PARTS.map((part) => [
			part,
			Math.max(0, PART_QUESTION_COUNTS[part] - Math.max(0, record.mistakes[part] ?? 0)),
		])
	) as Record<ReadingPartKey, number>;
	const noLapParts = READING_PARTS.filter((part) => record.readingLapTimes[part] === undefined);

	if (noLapParts.length > 0 && typeof currentLapIndex === "number") {
		for (let index = 0; index < READING_PARTS.length; index += 1) {
			const part = READING_PARTS[index];
			if (record.readingLapTimes[part] !== undefined && index < currentLapIndex) {
				capacities[part] = 0;
			}
		}
	}

	const weightedAllocation = allocateReadingUnfinishedByWeights(
		targetUnfinished,
		weights,
		capacities
	);
	const distribution = { ...weightedAllocation.distribution };
	let remaining = weightedAllocation.remaining;

	if (remaining > 0) {
		for (const part of getReadingFallbackOrder(record)) {
			if (remaining <= 0) {
				break;
			}

			const used = distribution[part] ?? 0;
			const capacity = capacities[part] - used;
			if (capacity <= 0) {
				continue;
			}

			const assigned = Math.min(capacity, remaining);
			distribution[part] = used + assigned;
			remaining -= assigned;
		}
	}

	const noLapAssigned = noLapParts.reduce((sum, part) => sum + (distribution[part] ?? 0), 0);
	const noLapShare = targetUnfinished > 0 ? noLapAssigned / targetUnfinished : 0;
	const confidence = hasSignal
		? clampConfidence(0.45 + noLapShare * 0.35 + (typeof currentLapIndex === "number" ? 0.15 : 0))
		: 0.25;

	return {
		distribution,
		confidence,
		source: hasSignal ? "inferred" : "fallback",
	};
}

function mergeMistakeSources(record: SessionRecord) {
	const parts = getPartsForType(record.type);

	return Object.fromEntries(
		parts.map((part) => [
			part,
			Math.max(0, (record.mistakes[part] ?? 0) + (record.overtimeMistakes?.[part] ?? 0)),
		])
	) as Record<MistakeKey, number>;
}

function buildPartMistakeMap(record: SessionRecord, mode: "strict" | "potential" = "strict") {
	const parts = getPartsForType(record.type);
	const mistakes = (mode === "potential" ? mergeMistakeSources(record) : Object.fromEntries(
		parts.map((part) => [part, Math.max(0, record.mistakes[part] ?? 0)])
	)) as Record<MistakeKey, number>;

	if (record.type === "R" && mode === "strict") {
		const unfinishedCount = Math.max(record.timerSummary?.unfinishedQuestions ?? 0, 0);
		let remainingUnfinished = unfinishedCount;
		if (remainingUnfinished <= 0) {
			return mistakes;
		}

		const manualDistribution = normalizeReadingPartDistribution(record.timerSummary?.unfinishedByPart);
		const manualTotal = sumReadingPartDistribution(manualDistribution);
		const inferred = manualTotal > 0
			? undefined
			: inferReadingUnfinishedDistribution(record, unfinishedCount);
		const preferredDistribution = manualTotal > 0
			? manualDistribution
			: inferred?.distribution ?? {};

		for (const part of READING_PARTS) {
			if (remainingUnfinished <= 0) {
				break;
			}

			const target = Math.max(0, preferredDistribution[part] ?? 0);
			if (target <= 0) {
				continue;
			}

			const capacity = PART_QUESTION_COUNTS[part] - mistakes[part];
			if (capacity <= 0) {
				continue;
			}

			const assigned = Math.min(capacity, target, remainingUnfinished);
			if (assigned <= 0) {
				continue;
			}

			mistakes[part] += assigned;
			remainingUnfinished -= assigned;
		}

		for (const part of getReadingFallbackOrder(record)) {
			if (remainingUnfinished <= 0) {
				break;
			}

			const capacity = PART_QUESTION_COUNTS[part] - mistakes[part];
			if (capacity <= 0) {
				continue;
			}

			const assigned = Math.min(capacity, remainingUnfinished);
			mistakes[part] += assigned;
			remainingUnfinished -= assigned;
		}
	}

	return mistakes;
}

export function getSessionPartLossMap(record: SessionRecord) {
	return buildPartMistakeMap(record);
}

export function getSessionPartLossMapByMode(
	record: SessionRecord,
	mode: "strict" | "potential"
) {
	return buildPartMistakeMap(record, mode);
}

function interpolateScaledScore(rawCorrect: number, anchors: readonly ScoreCheckpoint[]) {
	if (rawCorrect <= anchors[0].raw) {
		return anchors[0].scaled;
	}

	for (let index = 1; index < anchors.length; index += 1) {
		const previous = anchors[index - 1];
		const current = anchors[index];

		if (rawCorrect <= current.raw) {
			const span = current.raw - previous.raw;
			if (span <= 0) {
				return current.scaled;
			}

			const progress = (rawCorrect - previous.raw) / span;
			const scaled = previous.scaled + progress * (current.scaled - previous.scaled);
			return roundToNearestFive(scaled, 5, 495);
		}
	}

	return 495;
}

function getCefrLevelFromScores(listening: number, reading: number, total: number): ToeicCefrLevel {
	for (const threshold of CEFR_THRESHOLDS) {
		if (
			listening >= threshold.listening &&
			reading >= threshold.reading &&
			total >= threshold.total
		) {
			return threshold.level;
		}
	}

	return "Below A1";
}

function getSectionCefrLevel(score: number): ToeicCefrLevel {
	for (const threshold of SECTION_CEFR_THRESHOLDS) {
		if (score >= threshold.minimum) {
			return threshold.level;
		}
	}

	return "Below A1";
}

function formatEstimateBandFromThresholds(
	score: number,
	thresholds: ReadonlyArray<{ minimum: number }>,
	minimumScore: number,
	maximumScore: number
) {
	for (let index = 0; index < thresholds.length; index += 1) {
		const current = thresholds[index];
		if (score >= current.minimum) {
			const upper = index === 0 ? maximumScore : thresholds[index - 1].minimum - 5;
			return `${current.minimum}-${upper}`;
		}
	}

	const floorUpper = thresholds[thresholds.length - 1].minimum - 5;
	return `${minimumScore}-${floorUpper}`;
}

export function getSectionEstimateBand(score: number) {
	return formatEstimateBandFromThresholds(score, SECTION_CEFR_THRESHOLDS, 5, 495);
}

export function getCombinedEstimateBand(score: number) {
	return formatEstimateBandFromThresholds(score, CEFR_THRESHOLDS.map((threshold) => ({ minimum: threshold.total })), 10, 990);
}

export function estimateToeicSessionScore(
	record: SessionRecord,
	mode: "strict" | "potential" = "strict"
): ToeicSectionEstimate {
	const parts = getPartsForType(record.type);
	const totalQuestions = getQuestionCountForType(record.type);
	const config = PEASEA_SECTION_CONFIG[record.type];
	const partMistakes = buildPartMistakeMap(record, mode);
	const totalMistakes = parts.reduce((sum, part) => sum + partMistakes[part], 0);
	const rawCorrect = Math.max(totalQuestions - totalMistakes, 0);
	const basicMistakes = config.basicParts.reduce((sum, part) => sum + partMistakes[part], 0);
	const advancedMistakes = config.advancedParts.reduce((sum, part) => sum + partMistakes[part], 0);
	const basicQuestionCount = config.basicParts.reduce(
		(sum, part) => sum + PART_QUESTION_COUNTS[part],
		0
	);
	const advancedQuestionCount = config.advancedParts.reduce(
		(sum, part) => sum + PART_QUESTION_COUNTS[part],
		0
	);
	const basicErrorRate = basicQuestionCount > 0 ? basicMistakes / basicQuestionCount : 0;
	const advancedErrorRate = advancedQuestionCount > 0 ? advancedMistakes / advancedQuestionCount : 0;
	const anomalyGap = Math.max(0, basicErrorRate - advancedErrorRate);
	const deltaRaw = Number(
		(config.alpha * Math.min(0, advancedErrorRate - basicErrorRate) * 100).toFixed(2)
	);
	const penaltyRaw = Number(Math.abs(deltaRaw).toFixed(1));
	const adjustedRawCorrect = clampRawScore(rawCorrect + deltaRaw, record.type);
	const scaled = interpolateScaledScore(adjustedRawCorrect, config.anchors);
	const partStats = parts
		.map((part) => {
			const mistakes = Math.min(PART_QUESTION_COUNTS[part], partMistakes[part]);
			const questionCount = PART_QUESTION_COUNTS[part];
			return {
				part,
				questionCount,
				mistakes,
				correct: Math.max(questionCount - mistakes, 0),
				errorRate: questionCount > 0 ? mistakes / questionCount : 0,
				shareOfLoss: totalMistakes > 0 ? mistakes / totalMistakes : 0,
			};
		})
		.sort((left, right) => right.errorRate - left.errorRate);
	const weakestPart = partStats[0]?.part;
	const strongestPart = [...partStats].sort((left, right) => left.errorRate - right.errorRate)[0]?.part;
	const available = isSessionEstimateEligible(record);
	const interval = {
		min: roundToNearestFive(scaled - config.sem, 5, 495),
		max: roundToNearestFive(scaled + config.sem, 5, 495),
	};

	return {
		available,
		type: record.type,
		scoringMode: mode,
		rawCorrect,
		adjustedRawCorrect: Number(adjustedRawCorrect.toFixed(1)),
		scaled,
		interval,
		cefr: getSectionCefrLevel(scaled),
		sem: config.sem,
		bias: {
			alpha: config.alpha,
			basicErrorRate,
			advancedErrorRate,
			anomalyGap,
			deltaRaw,
			penaltyRaw,
			anomalyDetected: deltaRaw < 0,
		},
		partStats,
		strongestPart,
		weakestPart,
		unfinishedPenalty:
			record.type === "R" && mode === "strict"
				? Math.max(record.timerSummary?.unfinishedQuestions ?? 0, 0)
				: 0,
		resolvedUnfinished: hasResolvedUnfinished(record),
		overtimeElapsedMs: record.timerSummary?.overtimeElapsedMs,
		responsePattern: deltaRaw < 0 ? "aberrant" : "normal",
	};
}

export function estimateToeicSessionDualScore(record: SessionRecord) {
	return {
		strict: estimateToeicSessionScore(record, "strict"),
		potential: estimateToeicSessionScore(record, "potential"),
	};
}

export function estimateToeicCombinedScore(
	listeningRecord?: SessionRecord,
	readingRecord?: SessionRecord,
	mode: "strict" | "potential" = "strict"
): ToeicCombinedEstimate {
	const listening = listeningRecord ? estimateToeicSessionScore(listeningRecord, mode) : undefined;
	const reading = readingRecord ? estimateToeicSessionScore(readingRecord, mode) : undefined;
	const available = Boolean(listening?.available && reading?.available);
	const total = available ? (listening?.scaled ?? 0) + (reading?.scaled ?? 0) : 0;
	const sem = roundToNearestFive(
		Math.sqrt(
			Math.pow(listening?.sem ?? 0, 2) + Math.pow(reading?.sem ?? 0, 2)
		),
		0,
		100
	);

	return {
		available,
		scoringMode: mode,
		listening,
		reading,
		total,
		interval: {
			min: roundToNearestFive(total - sem, 10, 990),
			max: roundToNearestFive(total + sem, 10, 990),
		},
		cefr: available
			? getCefrLevelFromScores(listening?.scaled ?? 0, reading?.scaled ?? 0, total)
			: "Below A1",
		rawCorrect: (listening?.rawCorrect ?? 0) + (reading?.rawCorrect ?? 0),
		adjustedRawCorrect: Number(
			((listening?.adjustedRawCorrect ?? 0) + (reading?.adjustedRawCorrect ?? 0)).toFixed(1)
		),
		totalMistakes:
			(listening ? totalQuestionsFromEstimate(listening) - listening.rawCorrect : 0) +
			(reading ? totalQuestionsFromEstimate(reading) - reading.rawCorrect : 0),
		accuracy: available
			? Number(((((listening?.rawCorrect ?? 0) + (reading?.rawCorrect ?? 0)) / 200) * 100).toFixed(1))
			: 0,
		sem,
	};
}

export function estimateToeicCombinedDualScore(
	listeningRecord?: SessionRecord,
	readingRecord?: SessionRecord
) {
	return {
		strict: estimateToeicCombinedScore(listeningRecord, readingRecord, "strict"),
		potential: estimateToeicCombinedScore(listeningRecord, readingRecord, "potential"),
	};
}

function totalQuestionsFromEstimate(estimate: ToeicSectionEstimate) {
	return estimate.type === "L" ? 100 : 100;
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
			return "已完成复盘";
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
		const matchingSessions = completed.filter(
			(session) => session.type === getSessionTypeForPart(part)
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
	// Parse type and set number from id like "L3" or "R10"
	const idMatch = /^([LR])(\d+)$/.exec(incoming.id);
	const knownBlueprint = SESSION_BLUEPRINT_MAP.get(incoming.id);
	const knownInitial = INITIAL_SESSION_MAP.get(incoming.id);

	// Gracefully reconstruct blueprint for dynamic session counts
	const blueprint: SessionBlueprint = knownBlueprint ?? (idMatch ? {
		id: incoming.id,
		sprintDay: incoming.sprintDay ?? 1,
		type: idMatch[1] as SessionType,
		setNumber: Number(idMatch[2]),
		label: incoming.id,
		title: incoming.title ?? incoming.id,
		targetMinutes: idMatch[1] === "L" ? 45 : 75,
	} : (() => { throw new Error(`Unknown TOEIC session id: ${incoming.id}`); })());

	const initial: SessionRecord = knownInitial ?? {
		...blueprint,
		status: "not-started",
		mistakes: {},
		reasons: [],
		readingLapTimes: {},
	};

	return {
		...initial,
		...blueprint,
		...incoming,
		mistakes: incoming.mistakes ?? {},
		overtimeMistakes: incoming.overtimeMistakes ?? undefined,
		reasons: incoming.reasons ?? [],
		readingLapTimes: incoming.readingLapTimes ?? {},
		notes: incoming.notes ?? undefined,
		timerSummary: incoming.timerSummary
			? {
				...incoming.timerSummary,
				resolvedUnfinished: incoming.timerSummary.resolvedUnfinished ?? false,
				unfinishedByPart: normalizeReadingPartDistribution(incoming.timerSummary.unfinishedByPart),
				unfinishedByPartMeta: incoming.timerSummary.unfinishedByPartMeta
					? {
						source: incoming.timerSummary.unfinishedByPartMeta.source,
						confidence: clampConfidence(incoming.timerSummary.unfinishedByPartMeta.confidence),
					}
					: undefined,
			}
			: undefined,
		timerRuntime: incoming.timerRuntime
			? {
				...incoming.timerRuntime,
				unfinishedByPartDraft: normalizeReadingPartDistribution(incoming.timerRuntime.unfinishedByPartDraft),
			}
			: undefined,
	} as SessionRecord;
}

// ─── Aggregated Score Estimation ─────────────────────────────────────────────

/**
 * Aggregate multiple (L, R) session pairs into a single combined estimate.
 * Uses simple average across available pairs.
 */
export function estimateAggregatedScore(
	sessions: SessionRecord[],
	mode: "strict" | "potential" = "strict"
): ToeicCombinedEstimate | null {
	const listeningDone = sessions.filter((s) => s.type === "L" && isSessionEstimateEligible(s));
	const readingDone = sessions.filter((s) => s.type === "R" && isSessionEstimateEligible(s));

	if (listeningDone.length === 0 && readingDone.length === 0) return null;

	// Average across pairs by set number
	const setPairs = new Map<number, { l?: SessionRecord; r?: SessionRecord }>();
	for (const s of listeningDone) {
		const pair = setPairs.get(s.setNumber) ?? {};
		pair.l = s;
		setPairs.set(s.setNumber, pair);
	}
	for (const s of readingDone) {
		const pair = setPairs.get(s.setNumber) ?? {};
		pair.r = s;
		setPairs.set(s.setNumber, pair);
	}

	const estimates = [...setPairs.values()]
		.map(({ l, r }) => estimateToeicCombinedScore(l, r, mode))
		.filter((e) => e.available);

	if (estimates.length === 0) return estimateToeicCombinedScore(
		listeningDone[listeningDone.length - 1],
		readingDone[readingDone.length - 1],
		mode
	);

	const avgTotal = Math.round(estimates.reduce((sum, e) => sum + e.total, 0) / estimates.length);
	// Take the last estimate as the reference for metadata, override total
	const ref = estimates[estimates.length - 1];
	return { ...ref, total: avgTotal };
}

// ─── Target Gap Analysis ──────────────────────────────────────────────────────

export type TargetGapAnalysis = {
	targetTotal: number;
	currentTotal: number;
	gap: number;
	achieved: boolean;
	/** Per-part how many fewer mistakes needed if we assume equal distribution */
	partSuggestions: Array<{ part: MistakeKey; currentMistakes: number; suggestedMistakes: number; delta: number }>;
};

export function getTargetGapAnalysis(
	sessions: SessionRecord[],
	targetTotal: number,
	mode: "strict" | "potential" = "strict"
): TargetGapAnalysis | null {
	const latest = estimateToeicCombinedScore(
		[...sessions].reverse().find((s) => s.type === "L" && isSessionEstimateEligible(s)),
		[...sessions].reverse().find((s) => s.type === "R" && isSessionEstimateEligible(s)),
		mode
	);

	if (!latest.available) return null;

	const achieved = latest.total >= targetTotal;
	const gap = targetTotal - latest.total;

	const completed = sessions.filter((s) => isSessionEstimateEligible(s));
	const partSuggestions: TargetGapAnalysis["partSuggestions"] = [...LISTENING_PARTS, ...READING_PARTS].map((part) => {
		const matching = completed.filter((s) => getPartsForType(s.type).includes(part as never));
		if (matching.length === 0) return { part, currentMistakes: 0, suggestedMistakes: 0, delta: 0 };
		const avgMistakes = matching.reduce((sum, s) => sum + (s.mistakes[part] ?? 0), 0) / matching.length;
		// Very rough suggestion: reduce by ~10% per 50-point gap
		const reductionFactor = Math.max(0, Math.min(1, gap / 200));
		const suggested = Math.max(0, Math.round(avgMistakes * (1 - reductionFactor)));
		return { part, currentMistakes: Math.round(avgMistakes), suggestedMistakes: suggested, delta: Math.round(avgMistakes) - suggested };
	}).filter((s) => s.currentMistakes > 0 || s.delta !== 0);

	return { targetTotal, currentTotal: latest.total, gap, achieved, partSuggestions };
}
