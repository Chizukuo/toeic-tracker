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

export function generateVocabAssessmentPrompt(words: AIPromptVocabularyEntry[]): string {
  // Pass the raw data but strip definitions to focus the LLM on text and stats
  const simplifiedWords = words.map(w => ({
    text: w.text,
    encounters: w.encounterCount,
    misses: w.knockdownCount
  }));

  return `<system>
You are a senior TOEIC data analyst and vocabulary coach. Your task is to provide a comprehensive assessment report of the user's current vocabulary usage and progress based on their tracked data.
</system>

<user>
这是我目前 TOEIC 学习词表的状态数据，其中包含我查阅的单词、查阅次数（encounters）和练习不佳次数（misses）。请根据这份数据为我生成一份【综合水平测评与指导报告】。

【报告要求包含以下板块】：
1. **词汇特点与难度分布**：总结我的生词库具有什么特征，对应 TOEIC 的哪个分数段难度？
2. **核心高频考点分析**：列出词表中最具代表性的 3-5 个托业核心词，简要说明在听力或阅读中的常见考点。
3. **薄弱项图谱 (Weakness Analysis)**：根据 misses / encounters 数据，指出我最容易出错的词汇类型，帮我诊断可能的原因。
4. **行动建议 (Actionable Advice)**：接下来应该优先重点突击哪一类词汇或者进行何种针对性练习？

请使用友好、专业、鼓励的教练口吻，用 Markdown 格式输出。

以下是我的近期生词数据：
${JSON.stringify(simplifiedWords, null, 2)}
</user>`;
}