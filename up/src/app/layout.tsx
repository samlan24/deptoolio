import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import Navigation from "./components/Nav";
import Footer from "./components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pacgie - Secure, Updated & Optimized Dependencies",
    template: "%s | Pacgie",
  },
  description:
    "Connect GitHub repos or upload dependency files to detect security vulnerabilities, outdated packages, and unused dependencies. Supports JavaScript, Python, Go, Rust, PHP, and more.",
  keywords: [
    "dependency scanner",
    "vulnerability scanner",
    "security scanner",
    "outdated packages",
    "unused dependencies",
    "dependency management",
    "package scanner",
    "github integration",
    "package.json",
    "requirements.txt",
    "go.mod",
    "cargo.toml",
    "composer.json",
    "dependency security",
    "bundle optimization",
  ],
  authors: [{ name: "Pacgie" }],
  creator: "Pacgie",
  publisher: "Pacgie",
  twitter: {
    card: "summary_large_image",
    title: "Pacgie - Secure, Updated & Optimized Dependencies",
    description:
      "Scan for security vulnerabilities, outdated packages, and unused dependencies across multiple languages. GitHub integration included.",
    creator: "@pacgie",
  },
  openGraph: {
    title: "Pacgie - Secure, Updated & Optimized Dependencies",
    description:
      "Connect GitHub repos or upload dependency files to detect security vulnerabilities, outdated packages, and unused dependencies instantly.",
    type: "website",
    url: "https://www.pacgie.com",
    siteName: "Pacgie",
    locale: "en_US",
  },
  alternates: {
    canonical: "https://www.pacgie.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    other: {
      "msvalidate.01": "097F1884204971FF9F28F90ECC1A08F0",
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Pacgie",
  url: "https://www.pacgie.com",
  description:
    "Multi-language dependency scanner that detects security vulnerabilities, outdated packages, and unused dependencies. Supports GitHub integration and direct file uploads for JavaScript, Python, Go, Rust, PHP, and more.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  publisher: {
    "@type": "Organization",
    name: "Pacgie",
    url: "https://www.pacgie.com",
  },
  featureList: [
    "Security vulnerability detection",
    "Outdated package identification",
    "Unused dependency analysis",
    "GitHub repository integration",
    "Multi-language support",
    "Direct file upload scanning",
    "Bundle size optimization",
    "Dependency health reports",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-CPB8N6RKJ2"
        ></Script>
        <Script>
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
          `}
        </Script>

        <Script>
          {`
            gtag('config', 'G-CPB8N6RKJ2');
          `}
        </Script>
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
