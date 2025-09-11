import { createClient } from "@/prismicio";
import { NextResponse } from "next/server";

// Fetch all blog posts from Prismic
async function getBlogPosts() {
  const client = createClient();
  const posts = await client.getAllByType("blog_posts", {
    orderings: [{ field: "first_publication_date", direction: "desc" }],
  });

  return posts.map((post) => ({
    uid: post.uid,
    lastmod: post.last_publication_date || post.first_publication_date,
  }));
}

export async function GET(): Promise<Response> {
  const baseUrl: string =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.pacgie.com";

  try {
    const staticUrls: { loc: string; lastmod?: string }[] = [
      { loc: `${baseUrl}/` },
      { loc: `${baseUrl}/about` },
      { loc: `${baseUrl}/terms` },
      { loc: `${baseUrl}/privacy` },
      { loc: `${baseUrl}/login` },
      { loc: `${baseUrl}/blog` },
    ];

    // ✅ Fetch real posts with lastmod
    const blogPosts = await getBlogPosts();
    const blogUrls = blogPosts.map((post) => ({
      loc: `${baseUrl}/blog/${post.uid}`,
      lastmod: post.lastmod,
    }));

    const allUrls = [...staticUrls, ...blogUrls];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allUrls
    .map(
      ({ loc, lastmod }) =>
        `<url>
          <loc>${loc}</loc>
          ${
            lastmod
              ? `<lastmod>${new Date(lastmod).toISOString().split("T")[0]}</lastmod>`
              : ""
          }
        </url>`
    )
    .join("\n  ")}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (err: unknown) {
    console.error("🔥 Sitemap generation error:", err);
    return new Response("Sitemap generation failed", { status: 500 });
  }
}
