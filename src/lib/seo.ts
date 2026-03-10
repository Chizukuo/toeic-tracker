export const DEFAULT_SITE_URL = "https://toeic-tracker.pages.dev";

export const siteConfig = {
  name: "Cheese TOEIC Command Deck",
  shortName: "TOEIC Deck",
  description:
    "TOEIC 20天冲刺训练看板，集中管理听力与阅读练习进度、严格计时、错题复盘、未完成题追踪与实时估分。",
  locale: "zh_CN",
  keywords: [
    "TOEIC",
    "TOEIC tracker",
    "TOEIC study planner",
    "TOEIC timer",
    "TOEIC score estimator",
    "TOEIC 冲刺",
    "TOEIC 计时器",
    "TOEIC 学习计划",
    "TOEIC 错题复盘",
  ],
} as const;

function normalizeSiteUrl(value: string | undefined) {
  if (!value) {
    return DEFAULT_SITE_URL;
  }

  try {
    return new URL(value).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const metadataBase = new URL(siteUrl);

export const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteUrl,
    inLanguage: ["zh-CN", "en"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description: siteConfig.description,
    inLanguage: ["zh-CN", "en"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  },
];