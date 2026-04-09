import { VocabularyEntry } from '@/lib/toeic';

export interface LookupResult {
  definition: string;
  enDefinition?: string;
  partOfSpeech: string;
  exampleSentence?: string;
  reading?: string;
}

export const PLACEHOLDER_DEFINITIONS = new Set(['-', '--', '—', 'n/a', 'na']);
export const VIOLENT_DEFINITION_HINTS = [
  'bullet',
  'ammunition',
  'gunpowder',
  'firearm',
  'weapon',
  'rifle',
  'pistol',
  'grenade',
  'bomb',
];
export const TOEIC_FRIENDLY_HINTS = [
  'business',
  'office',
  'printer',
  'toner',
  'document',
  'meeting',
  'contract',
  'invoice',
  'shipment',
  'schedule',
  'email',
  'computer',
  'software',
  'data',
  'company',
  'customer',
  'employee',
  'manager',
  'sale',
  'service',
  'equipment',
];

export function normalizeDefinitionText(value?: string) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return '';
  if (PLACEHOLDER_DEFINITIONS.has(trimmed.toLowerCase())) return '';
  return trimmed;
}

export function containsViolentHint(text?: string) {
  const normalized = normalizeDefinitionText(text).toLowerCase();
  if (!normalized) return false;
  return VIOLENT_DEFINITION_HINTS.some((keyword) => normalized.includes(keyword));
}

export function isLikelyEnglishText(text?: string) {
  const normalized = normalizeDefinitionText(text);
  return /[a-z]/i.test(normalized);
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function getDaysSince(isoTime: string) {
  const timestamp = Date.parse(isoTime);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / DAY_MS));
}

export type DictionaryCandidate = {
  definition: string;
  partOfSpeech: string;
  exampleSentence?: string;
};

export type DictionaryApiDefinition = {
  definition?: string;
  example?: string;
};

export type DictionaryApiMeaning = {
  partOfSpeech?: string;
  definitions?: DictionaryApiDefinition[];
};

export type DictionaryApiPhonetic = {
  text?: string;
};

export type DictionaryApiEntry = {
  meanings?: DictionaryApiMeaning[];
  phonetics?: DictionaryApiPhonetic[];
};

export function scoreDictionaryCandidate(candidate: DictionaryCandidate) {
  const normalized = candidate.definition.toLowerCase();
  let score = 0;

  if (containsViolentHint(candidate.definition)) score -= 8;
  if (normalized.includes('(by extension)')) score += 2;
  if (candidate.partOfSpeech === 'noun') score += 1;

  for (const keyword of TOEIC_FRIENDLY_HINTS) {
    if (normalized.includes(keyword)) score += 2;
  }

  return score;
}

export function pickBestDictionaryCandidate(entry: DictionaryApiEntry): DictionaryCandidate | null {
  const candidates: DictionaryCandidate[] = [];
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];

  meanings.forEach((meaning) => {
    const partOfSpeech = typeof meaning?.partOfSpeech === 'string' ? meaning.partOfSpeech : '';
    const definitions = Array.isArray(meaning?.definitions) ? meaning.definitions : [];

    definitions.forEach((item) => {
      const definition = normalizeDefinitionText(item?.definition);
      if (!definition) return;
      const exampleSentence = normalizeDefinitionText(item?.example) || undefined;
      candidates.push({ definition, partOfSpeech, exampleSentence });
    });
  });

  if (candidates.length === 0) return null;

  return candidates
    .map((candidate, index) => ({ candidate, index, score: scoreDictionaryCandidate(candidate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.candidate ?? null;
}

export const DICT_CACHE_KEY = 'cheese-dict-cache-v1';

export function getCache(): Record<string, LookupResult> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(DICT_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function setCache(word: string, result: LookupResult) {
  if (typeof window === 'undefined') return;
  try {
    const cache = getCache();
    cache[word.toLowerCase()] = result;
    const keys = Object.keys(cache);
    if (keys.length > 500) {
      delete cache[keys[0]];
    }
    localStorage.setItem(DICT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export async function lookupWord(text: string, options: { forceZhRetry?: boolean; ignoreCache?: boolean } = {}): Promise<LookupResult | null> {
  const normalized = text.trim().toLowerCase();
  const isPhrase = normalized.split(/\s+/).length > 2;
  if (isPhrase) return null;

  if (!options.ignoreCache) {
    const cache = getCache();
    const cached = cache[normalized];
    if (cached) {
      const looksLikeFailedZh = cached.definition && cached.definition === cached.enDefinition && isLikelyEnglishText(cached.definition);
      if (!(options.forceZhRetry && looksLikeFailedZh)) {
        return cached;
      }
    }
  }

  try {
    const q = encodeURIComponent(normalized);
    let definition = '';
    let enDefinition = '';
    let partOfSpeech = '';
    let exampleSentence = '';
    let reading = '';

    try {
      const enRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${q}`);
      if (enRes.ok) {
        const enData = (await enRes.json()) as DictionaryApiEntry[];
        const entry = enData[0];
        if (entry) {
          const bestCandidate = pickBestDictionaryCandidate(entry);
          definition = bestCandidate?.definition || '';
          enDefinition = bestCandidate?.definition || '';
          partOfSpeech = bestCandidate?.partOfSpeech || '';
          exampleSentence = bestCandidate?.exampleSentence || '';
          reading = entry.phonetics?.find((p) => p.text)?.text || '';
        }
      }
    } catch {}

    try {
      const zhRes = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&dt=bd&q=${q}`);
      if (zhRes.ok) {
        const zhData = await zhRes.json();
        let translated = '';
        if (zhData[1] && zhData[1][0] && zhData[1][0][1]) {
           translated = zhData[1][0][1].slice(0, 3).join('，');
        } else if (zhData[0] && zhData[0][0] && zhData[0][0][0]) {
           translated = zhData[0][0][0];
        }
        if (translated && translated.toLowerCase() !== text.trim().toLowerCase()) {
          definition = translated;
        }
      }
    } catch {}

    const result: LookupResult = {
      definition: normalizeDefinitionText(definition),
      enDefinition: normalizeDefinitionText(enDefinition) || undefined,
      partOfSpeech,
      exampleSentence,
      reading,
    };

    if (result.definition || result.enDefinition) {
      setCache(normalized, result);
    }
    return result;
  } catch {
    return null;
  }
}
