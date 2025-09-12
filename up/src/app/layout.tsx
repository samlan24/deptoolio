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
    default: "Pacgie - Stop Fighting Dependency Hell",
    template: "%s | Pacgie",
  },
  description:
    "Upload your package.json, requirements.txt, or dependency file and instantly see which packages need updating. Supports Node.js, Python, Go, PHP, and more.",
  keywords: [
    "dependency scanner",
    "package scanner",
    "vulnerability scanner",
    "outdated packages",
    "package.json",
    "requirements.txt",
    "dependency management",
  ],
  authors: [{ name: "Pacgie" }],
  creator: "Pacgie",
  publisher: "Pacgie",
  twitter: {
    card: "summary_large_image",
    title: "Pacgie - Stop Fighting Dependency Hell",
    description:
      "Upload your dependency files and instantly see which packages need updating. Supports Node.js, Python, Go, PHP, and more.",
    creator: "@pacgie",
  },
  openGraph: {
    title: "Pacgie - Stop Fighting Dependency Hell",
    description:
      "Upload your dependency files and instantly see which packages need updating. Supports Node.js, Python, Go, PHP, and more.",
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
    "Upload your package.json, requirements.txt, or dependency file and instantly see which packages need updating. Supports Node.js, Python, Go, PHP, and more.",
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
    "Dependency scanning",
    "Vulnerability detection",
    "Package update recommendations",
    "Multi-language support",
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
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-CPB8N6RKJ2"></Script>
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
