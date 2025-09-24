// app/robots.ts
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: ['/api/', '/dashboard','/repo-scanner', '/depscanner'],
    },
    sitemap: 'https://www.pacgie.com/sitemap.xml',
  }
}