import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth/signin", "/feedback"],
        disallow: [
          "/api/",
          "/auth/callback",
          "/games",
          "/analysis",
          "/practice",
          "/progress",
          "/account",
        ],
      },
    ],
    sitemap: "https://chessblunders.org/sitemap.xml",
  };
}
