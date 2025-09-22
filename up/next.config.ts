import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* your existing config options here */
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `
            default-src 'self';
            script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://static.hotjar.com https://script.hotjar.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://www.google.com https://tpc.googlesyndication.com;
            style-src 'self' 'unsafe-inline' https://static.hotjar.com;
            img-src 'self' data: https: https://www.google-analytics.com https://script.hotjar.com;
            font-src 'self' data: https://static.hotjar.com;
            connect-src 'self' https: https://www.google-analytics.com https://region1.google-analytics.com https://*.hotjar.com https://*.hotjar.io wss://*.hotjar.com data: blob:;
            frame-ancestors 'self';
            frame-src https://vars.hotjar.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com;
          `.replace(/\s{2,}/g, " "),
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.prismic.io',
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);