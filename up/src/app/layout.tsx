import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
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
    default: "Pacgie",
    template: "%s | Pacgie",
  },
  description: "Package file scanner for outdated and vulnerable dependencies.",
  twitter: {
    card: "summary_large_image",
    title: "Pacgie",
    description:
      "Package file scanner for outdated and vulnerable dependencies.",
  },
  openGraph: {
    title: "Pacgie",
    description:
      "Package file scanner for outdated and vulnerable dependencies.",
    type: "website",
    url: "https://deptoolio.vercel.app",
  },
  alternates: {
    canonical: "https://deptoolio.vercel.app",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Pacgie",
  url: "https://deptoolio.vercel.app",
  description:
    "Pacgie is a package file scanner that checks for outdated and vulnerable dependencies across multiple programming languages.",
  publisher: {
    "@type": "Organization",
    name: "Pacgie",
    url: "https://deptoolio.vercel.app",
  },
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
      </head>
      <body className={`${inter.variable} antialiased`}>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
