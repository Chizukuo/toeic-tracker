import type { MetadataRoute } from "next";

import { isPreviewDeployment, siteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isPreviewDeployment
      ? {
          userAgent: "*",
          disallow: "/",
        }
      : {
          userAgent: "*",
          allow: "/",
        },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}