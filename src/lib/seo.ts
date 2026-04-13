import type { Metadata } from "next";

export const DEFAULT_SITE_URL = "https://toeic.chizunet.cc";
export const ASSET_VERSION = "20260329";

export const siteConfig = {
  name: "Cheese TOEIC Tracker",
  shortName: "toeic tracker",
  creator: "Chizukuo",
  description:
    "Cheese TOEIC Tracker — TOEIC（托业）20天冲刺训练看板，集中管理听力与阅读练习进度、严格计时、错题复盘、未完成题追踪与实时估分。适合想在短期内提升托业成绩的考生。",
  locale: "zh_CN",
  keywords: [
    "Cheese TOEIC",
    "Cheese TOEIC Tracker",
    "cheese toeic",
    "toeic tracker",
    "TOEIC",
    "托业",
    "托业 备考",
    "托业 练习",
    "托业 冲刺",
    "托业 词汇",
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

function normalizeSiteUrl(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

const configuredSiteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL, DEFAULT_SITE_URL);
const deploymentSiteUrl = normalizeSiteUrl(process.env.CF_PAGES_URL, configuredSiteUrl);
const isCloudflarePages = process.env.CF_PAGES === "1";
const canonicalHost = new URL(configuredSiteUrl).host;
const deploymentHost = new URL(deploymentSiteUrl).host;
const cloudflareBranch = process.env.CF_PAGES_BRANCH?.toLowerCase();
const cloudflareProductionBranch = process.env.CF_PAGES_PRODUCTION_BRANCH?.toLowerCase();
const explicitSeoDeployment = process.env.NEXT_PUBLIC_SEO_DEPLOYMENT?.toLowerCase();

const isNonProductionBranch = Boolean(
  isCloudflarePages
    && cloudflareBranch
    && cloudflareProductionBranch
    && cloudflareBranch !== cloudflareProductionBranch
);

const deploymentHostSegments = deploymentHost.split(".");
const isLikelyPreviewPagesHost = Boolean(
  isCloudflarePages
    && deploymentHost.endsWith(".pages.dev")
    && deploymentHostSegments.length > 3
);
const isHostMismatch = isCloudflarePages && deploymentHost !== canonicalHost;
const isExplicitPreview = explicitSeoDeployment === "preview";
const isExplicitProduction = explicitSeoDeployment === "production";

// Treat host mismatch as preview only when branch metadata is missing.
export const isPreviewDeployment = Boolean(
  isExplicitPreview
  || (!isExplicitProduction && (isNonProductionBranch
    || (isLikelyPreviewPagesHost && !cloudflareProductionBranch)
    || (isHostMismatch && !cloudflareBranch)))
);
export const siteUrl = configuredSiteUrl;
export const metadataBase = new URL(siteUrl);

export const defaultIcon = {
  url: `/icon?v=${ASSET_VERSION}`,
  sizes: "512x512",
  type: "image/png",
} as const;

export const defaultAppleIcon = {
  url: `/apple-icon?v=${ASSET_VERSION}`,
  sizes: "180x180",
  type: "image/png",
} as const;

export const defaultRobots: Metadata["robots"] = isPreviewDeployment
  ? {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        "max-image-preview": "none",
        "max-snippet": 0,
        "max-video-preview": 0,
      },
    }
  : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    };

export const defaultOpenGraphImage = {
  url: `/opengraph-image?v=${ASSET_VERSION}`,
  width: 1200,
  height: 630,
  alt: "Cheese TOEIC Tracker 分享图片 / Cheese TOEIC Tracker share image",
  type: "image/png",
} as const;

export const defaultTwitterImage = {
  url: `/twitter-image?v=${ASSET_VERSION}`,
  width: 1200,
  height: 630,
  alt: "Cheese TOEIC Tracker Twitter 卡片 / Cheese TOEIC Tracker Twitter card",
  type: "image/png",
} as const;

function normalizePath(path: string) {
  if (!path || path === "/") {
    return "/";
  }

  const trimmed = path.trim().replace(/\\+/g, "/").replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "/";
}

function formatSocialTitle(title: string) {
  return title === siteConfig.name ? title : `${title} | ${siteConfig.name}`;
}

type PageMetadataInput = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
};

export function buildPageMetadata({
  title,
  description,
  path = "/",
  keywords = [],
}: PageMetadataInput): Metadata {
  const canonicalPath = normalizePath(path);
  const socialTitle = formatSocialTitle(title);

  return {
    title,
    description,
    keywords: [...siteConfig.keywords, ...keywords],
    alternates: {
      canonical: canonicalPath,
    },
    robots: defaultRobots,
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      alternateLocale: ["en_US"],
      url: canonicalPath,
      siteName: siteConfig.name,
      title: socialTitle,
      description,
      images: [defaultOpenGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [defaultTwitterImage],
    },
  };
}

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
    headline: siteConfig.description,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description: siteConfig.description,
    image: `${siteUrl}${defaultOpenGraphImage.url}`,
    inLanguage: ["zh-CN", "en"],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  },
];