import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth/signin"],
        disallow: [
          "/api/",
          "/auth/callback",
          "/games",
          "/analysis",
          "/practice",
          "/progress",
          "/account",
          "/feedback",
        ],
      },
    ],
    sitemap: "https://chessblunders.org/sitemap.xml",
  };
}
