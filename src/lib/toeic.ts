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

/**
 * Answer-pattern diagnostics. TOEIC is number-right scoring, so the pattern never moves the
 * point estimate; an unusual pattern (more slips on easy items than on hard ones) only widens
 * the uncertainty interval. `deltaRaw` / `penaltyRaw` stay for compatibility and are always 0.
 */
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
	/** Expected correct answers from filling unanswered 4-option items at random (strict mode only). */
	guessCredit: number;
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

/** Every Reading item (Parts 5–7) has four options, so a blind guess is right 1 time in 4. */
const READING_GUESS_RATE = 0.25;
/** Easy-vs-hard error-rate gap (percentage points / 100) treated as an unusual answer pattern. */
const ABERRANT_GAP_THRESHOLD = 0.1;
/** Extra uncertainty, in scaled points, when the answer pattern is unusual. */
const ABERRANT_SEM_WIDENING = 10;
/** Recent sets used for the current-level estimate, and the recency half-life in sets. */
const LEVEL_WINDOW = 5;
const LEVEL_HALF_LIFE_SETS = 2;

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
	return roundToNearestFive(interpolateScaledExact(rawCorrect, anchors), 5, 495);
}

/** The conversion curve without the 5-point rounding, for comparing small raw changes. */
function interpolateScaledExact(rawCorrect: number, anchors: readonly ScoreCheckpoint[]) {
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
			return previous.scaled + progress * (current.scaled - previous.scaled);
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
	const anomalyDetected = anomalyGap >= ABERRANT_GAP_THRESHOLD;
	// No penalty for wrong answers on TOEIC, so on test day every blank gets bubbled in.
	const unanswered = record.type === "R" && mode === "strict"
		? Math.max(record.timerSummary?.unfinishedQuestions ?? 0, 0)
		: 0;
	const guessCredit = Number((Math.min(unanswered, totalMistakes) * READING_GUESS_RATE).toFixed(2));
	const adjustedRawCorrect = clampRawScore(rawCorrect + guessCredit, record.type);
	const scaled = interpolateScaledScore(adjustedRawCorrect, config.anchors);
	const sem = config.sem + (anomalyDetected ? ABERRANT_SEM_WIDENING : 0);
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
		min: roundToNearestFive(scaled - sem, 5, 495),
		max: roundToNearestFive(scaled + sem, 5, 495),
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
		sem,
		bias: {
			alpha: config.alpha,
			basicErrorRate,
			advancedErrorRate,
			anomalyGap,
			deltaRaw: 0,
			penaltyRaw: 0,
			anomalyDetected,
		},
		partStats,
		strongestPart,
		weakestPart,
		unfinishedPenalty: unanswered,
		guessCredit,
		resolvedUnfinished: hasResolvedUnfinished(record),
		overtimeElapsedMs: record.timerSummary?.overtimeElapsedMs,
		responsePattern: anomalyDetected ? "aberrant" : "normal",
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
// ─── Current level (multi-set) ───────────────────────────────────────────────

export type ToeicSectionLevel = {
	type: SessionType;
	scaled: number;
	interval: ScoreInterval;
	/** Effective correct answers behind the level (guess credit included), for target planning. */
	rawCorrect: number;
	setsUsed: number;
	/** Least-squares slope over the sets used, in scaled points per set (oldest → newest). */
	trendPerSet: number;
	latest: ToeicSectionEstimate;
};

export type ToeicLevelEstimate = {
	listening?: ToeicSectionLevel;
	reading?: ToeicSectionLevel;
	/** Present only when both sections have at least one usable set. */
	total?: {
		scaled: number;
		interval: ScoreInterval;
		cefr: ToeicCefrLevel;
	};
};

function getSessionRecency(record: SessionRecord) {
	const stamp = record.timerSummary?.completedAt ?? record.updatedAt;
	const parsed = stamp ? new Date(stamp).getTime() : NaN;
	return Number.isFinite(parsed) ? parsed : record.setNumber;
}

/**
 * Current ability per section from the most recent sets, weighted toward the newest
 * (half-life of two sets). One practice set carries roughly ±25 points of measurement error;
 * averaging several shrinks that by √(effective set count), unless the sets themselves
 * disagree more than that, in which case the observed spread is used instead.
 */
export function estimateSectionLevel(
	sessions: SessionRecord[],
	type: SessionType,
	mode: "strict" | "potential" = "strict"
): ToeicSectionLevel | undefined {
	const recent = sessions
		.filter((session) => session.type === type && isSessionEstimateEligible(session))
		.sort((left, right) => getSessionRecency(right) - getSessionRecency(left))
		.slice(0, LEVEL_WINDOW);

	if (recent.length === 0) {
		return undefined;
	}

	const estimates = recent.map((session) => estimateToeicSessionScore(session, mode));
	const weights = estimates.map((_, index) => Math.pow(0.5, index / LEVEL_HALF_LIFE_SETS));
	const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
	const weightedMean = (values: number[]) =>
		values.reduce((sum, value, index) => sum + value * weights[index], 0) / weightSum;

	const meanScaled = weightedMean(estimates.map((estimate) => estimate.scaled));
	const meanRaw = weightedMean(estimates.map((estimate) => estimate.adjustedRawCorrect));
	const effectiveSets = (weightSum * weightSum) / weights.reduce((sum, weight) => sum + weight * weight, 0);
	const measurementError = weightedMean(estimates.map((estimate) => estimate.sem));
	const spread = estimates.length > 1
		? Math.sqrt(weightedMean(estimates.map((estimate) => Math.pow(estimate.scaled - meanScaled, 2))))
		: 0;
	const halfWidth = Math.max(measurementError, spread) / Math.sqrt(effectiveSets);
	const scaled = roundToNearestFive(meanScaled, 5, 495);

	// Slope across the window in chronological order; only meaningful with three or more sets.
	let trendPerSet = 0;
	if (estimates.length >= 3) {
		const chronological = [...estimates].reverse().map((estimate) => estimate.scaled);
		const n = chronological.length;
		const meanX = (n - 1) / 2;
		const meanY = chronological.reduce((sum, value) => sum + value, 0) / n;
		let numerator = 0;
		let denominator = 0;
		chronological.forEach((value, index) => {
			numerator += (index - meanX) * (value - meanY);
			denominator += Math.pow(index - meanX, 2);
		});
		trendPerSet = denominator > 0 ? Math.round(numerator / denominator) : 0;
	}

	return {
		type,
		scaled,
		interval: {
			min: roundToNearestFive(meanScaled - halfWidth, 5, 495),
			max: roundToNearestFive(meanScaled + halfWidth, 5, 495),
		},
		rawCorrect: Number(meanRaw.toFixed(1)),
		setsUsed: estimates.length,
		trendPerSet,
		latest: estimates[0],
	};
}

export function estimateCurrentLevel(
	sessions: SessionRecord[],
	mode: "strict" | "potential" = "strict"
): ToeicLevelEstimate {
	const listening = estimateSectionLevel(sessions, "L", mode);
	const reading = estimateSectionLevel(sessions, "R", mode);

	if (!listening || !reading) {
		return { listening, reading };
	}

	const scaled = listening.scaled + reading.scaled;
	const halfWidth = Math.sqrt(
		Math.pow((listening.interval.max - listening.interval.min) / 2, 2) +
		Math.pow((reading.interval.max - reading.interval.min) / 2, 2)
	);

	return {
		listening,
		reading,
		total: {
			scaled,
			interval: {
				min: roundToNearestFive(scaled - halfWidth, 10, 990),
				max: roundToNearestFive(scaled + halfWidth, 10, 990),
			},
			cefr: getCefrLevelFromScores(listening.scaled, reading.scaled, scaled),
		},
	};
}

// ─── Target planning ──────────────────────────────────────────────────────────

export type TargetCorrectPlan = {
	/** Additional correct answers needed per section (0 when already on target). */
	listening: number;
	reading: number;
	total: number;
	reachable: boolean;
};

/**
 * Fewest extra correct answers that lift the estimated total to `targetTotal`, adding one
 * answer at a time to whichever section converts it into more scaled points.
 */
export function planCorrectAnswersForTarget(
	listeningRaw: number,
	readingRaw: number,
	targetTotal: number
): TargetCorrectPlan {
	let listening = clampRawScore(listeningRaw, "L");
	let reading = clampRawScore(readingRaw, "R");
	const startListening = listening;
	const startReading = reading;
	const exact = (raw: number, type: SessionType) =>
		interpolateScaledExact(clampRawScore(raw, type), PEASEA_SECTION_CONFIG[type].anchors);
	// Reported totals are rounded to 5, so stop once the rounded total reaches the target.
	const totalFor = (l: number, r: number) =>
		estimateToeicScaledScore(l, "L") + estimateToeicScaledScore(r, "R");

	while (totalFor(listening, reading) < targetTotal && (listening < 100 || reading < 100)) {
		const listeningGain = listening < 100 ? exact(listening + 1, "L") - exact(listening, "L") : -1;
		const readingGain = reading < 100 ? exact(reading + 1, "R") - exact(reading, "R") : -1;

		if (readingGain > listeningGain) {
			reading = Math.min(reading + 1, 100);
		} else {
			listening = Math.min(listening + 1, 100);
		}
	}

	const extraListening = Math.ceil(listening - startListening);
	const extraReading = Math.ceil(reading - startReading);

	return {
		listening: extraListening,
		reading: extraReading,
		total: extraListening + extraReading,
		reachable: totalFor(listening, reading) >= targetTotal,
	};
}
