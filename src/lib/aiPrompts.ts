export type AIPromptVocabularyEntry = {
  text: string;
  reading?: string;
  partOfSpeech?: string;
  definition?: string;
  enDefinition?: string;
  exampleSentence?: string;
  encounterCount?: number;
  knockdownCount?: number;
};

export function generateToeicOptimizationPrompt(words: AIPromptVocabularyEntry[]): string {
  return `<system>
You are an expert TOEIC tutor and business English translator. Your task is to enrich and optimize a JSON array of vocabulary for a TOEIC testing context.
</system>

<user>
我正在备考 TOEIC (托业)，请帮我给以下单词表补充适用于【托业商务与职场场景】的具体信息。

【重要要求】：
1. 请完全保持原有数据的 JSON 结构，并确保它是一个合法的 JSON 数组，直接包裹在 \`\`\`json\`\`\` 即可，不要输出任何额外的废话。
2. 必须保留原有的 "text" 字段。
3. 请为每个单词深度填充或优化以下字段：
   - "reading": 准确的英语音标（如 "/bɔːrd/"）
   - "partOfSpeech": 词性缩写（如 "n.", "v."）
   - "definition": 职场/托业场景下的中文释义。
   - "enDefinition": 对应场景下的简短英文释义。
   - "exampleSentence": 补充一个包含此单词场景的精彩 TOEIC 英文例句。

【Few-Shot 示例】：
如果原词是 "board"，请翻译为 "董事会/委员会"，而不是 "木板"。
如果原词是 "party"，请翻译为 "当事人/一方"，而不是 "派对"。
如果原词是 "outstanding"，请翻译为 "未偿付的/未结清的"，而不是 "优秀的"（当偏向财务场景时）。

以下是我的需要优化的单词列表 JSON 数组：
${JSON.stringify(words, null, 2)}
</user>`;
}
