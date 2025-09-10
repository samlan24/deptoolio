// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/about', '/terms', '/privacy', '/guides', '/checks', '/login'],
      disallow: ['/api/', '/dashboard', '/repo-scanner'],
    },
    sitemap: 'https://www.pacgie.com/sitemap.xml', // Note: using www since that's your canonical
  }
}