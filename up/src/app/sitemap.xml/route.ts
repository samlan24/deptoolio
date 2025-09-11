import { NextResponse } from 'next/server';

// Example data fetching function for blog UIDs - replace with your real data source
async function getBlogPostUIDs(): Promise<string[]> {
  // Replace with your real API call or data fetching logic
  return ['post-1', 'post-2', 'post-3'];
}

export async function GET(): Promise<Response> {
  const baseUrl: string =
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://www.pacgie.com';

  try {
    const staticUrls: string[] = [
      `${baseUrl}/`,
      `${baseUrl}/about`,
      `${baseUrl}/terms`,
      `${baseUrl}/privacy`,
      `${baseUrl}/login`,
      `${baseUrl}/blog`,
    ];

    // Fetch blog post UIDs dynamically
    const blogUIDs = await getBlogPostUIDs();

    // Generate dynamic blog URLs like /blog/post-1, /blog/post-2 etc.
    const blogUrls = blogUIDs.map((uid) => `${baseUrl}/blog/${uid}`);

    // Combine all URLs
    const allUrls = [...staticUrls, ...blogUrls];

    // Generate sitemap XML string
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${allUrls.map((url) => `<url><loc>${url}</loc></url>`).join('')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  } catch (err: unknown) {
    console.error('🔥 Sitemap generation error:', err);
    return new Response('Sitemap generation failed', { status: 500 });
  }
}
