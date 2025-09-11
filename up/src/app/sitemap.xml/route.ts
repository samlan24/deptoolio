import { createClient } from "@/prismicio";
import { NextResponse } from "next/server";

// Fetch all blog post UIDs from Prismic
async function getBlogPostUIDs(): Promise<string[]> {
  const client = createClient();
  const posts = await client.getAllByType("blog_posts", {
    // optional: order or page size
    orderings: [{ field: "first_publication_date", direction: "desc" }],
  });

  return posts.map((post) => post.uid); // Extract UIDs
}

export async function GET(): Promise<Response> {
  const baseUrl: string =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://www.pacgie.com";

  try {
    const staticUrls: string[] = [
      `${baseUrl}/`,
      `${baseUrl}/about`,
      `${baseUrl}/terms`,
      `${baseUrl}/privacy`,
      `${baseUrl}/login`,
      `${baseUrl}/blog`,
    ];

    // ✅ Pull real UIDs
    const blogUIDs = await getBlogPostUIDs();

    const blogUrls = blogUIDs.map((uid) => `${baseUrl}/blog/${uid}`);

    const allUrls = [...staticUrls, ...blogUrls];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allUrls.map((url) => `<url><loc>${url}</loc></url>`).join("\n  ")}
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
