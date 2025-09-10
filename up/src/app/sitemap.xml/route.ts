import { NextResponse } from 'next/server';

export async function GET(): Promise<Response> {
  const baseUrl: string =
    process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "https://pacgie.com";

  try {
    const staticUrls: string[] = [
      `${baseUrl}/`,
      `${baseUrl}/about`,
      `${baseUrl}/terms`,
      `${baseUrl}/guides`,
      `${baseUrl}/privacy`,
      `${baseUrl}/guides`,
      `${baseUrl}/checks`,
      `${baseUrl}/login`,
    ];

    const sitemap: string = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticUrls.map((url: string) => `<url><loc>${url}</loc></url>`).join("")}
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