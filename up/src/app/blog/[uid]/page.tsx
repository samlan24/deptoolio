import { Metadata } from "next";
import React, { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PrismicRichText, JSXMapSerializer } from "@prismicio/react";
import { SliceZone } from "@prismicio/react";
import { asText } from "@prismicio/helpers";
import { createClient } from "@/prismicio";
import Image from "next/image";
import Link from "next/link";
import DependencyCta from "../../../slices/DependencyCta";

interface Props {
  params: Promise<{ uid: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uid } = await params;
  const client = createClient();
  try {
    const post = await client.getByUID("blog_posts", uid, {
      fetchOptions: { next: { tags: ["prismic"] } },
    });

    return {
      title:
        asText(post.data.meta_title) || asText(post.data.title) || "Blog Post",
      description:
        asText(post.data.meta_description) || asText(post.data.excerpt) || "",
      authors: [{ name: post.data.author || "Pacgie" }],
      openGraph: {
        title: asText(post.data.meta_title) || asText(post.data.title),
        description:
          asText(post.data.meta_description) || asText(post.data.excerpt),
        type: "article",
        url: `https://www.pacgie.com/blog/${uid}`,
        siteName: "Pacgie",
        images: post.data.featured_image?.url
          ? [
              {
                url: post.data.featured_image.url,
                alt: post.data.featured_image.alt || "",
              },
            ]
          : [],
        publishedTime: post.data.published_date || post.first_publication_date,
        authors: [post.data.author || "Pacgie"],
      },
      twitter: {
        card: "summary_large_image",
        title: asText(post.data.meta_title) || asText(post.data.title),
        description:
          asText(post.data.meta_description) || asText(post.data.excerpt),
      },
      alternates: {
        canonical: `https://www.pacgie.com/blog/${uid}`,
      },
    };
  } catch {
    return {
      title: "Blog Post",
      description: "",
    };
  }
}

const generateBlogPostStructuredData = (post: any, uid: string) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: asText(post.data.title),
  description:
    asText(post.data.excerpt) || asText(post.data.meta_description) || "",
  image: post.data.featured_image?.url || "",
  author: {
    "@type": "Person",
    name: post.data.author || "Pacgie",
  },
  publisher: {
    "@type": "Organization",
    name: "Pacgie",
    url: "https://www.pacgie.com",
  },
  datePublished: post.data.published_date || post.first_publication_date,
  dateModified:
    post.last_publication_date ||
    post.data.published_date ||
    post.first_publication_date,
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": `https://www.pacgie.com/blog/${uid}`,
  },
  url: `https://www.pacgie.com/blog/${uid}`,
});

// Extract headings for table of contents
const extractHeadings = (content: any[]): Array<{ id: string; text: string; level: number }> => {
  const headings: Array<{ id: string; text: string; level: number }> = [];

  const processSpan = (span: any): string => {
    if (span.type === "span") {
      return span.text || "";
    }
    return "";
  };

  content?.forEach((slice: any) => {
    if (slice.type?.startsWith("heading")) {
      const level = parseInt(slice.type.replace("heading", ""));
      const text = slice.spans?.map(processSpan).join("") || "";
      if (text.trim()) {
        const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
        headings.push({ id, text: text.trim(), level });
      }
    }
  });

  return headings;
};

const richTextComponents: JSXMapSerializer = {
  heading1: ({ children, node }) => {
    const text = typeof children === "string" ? children :
      Array.isArray(children) ? children.join("") : "";
    const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    return (
      <h1 id={id} data-section={id} className="text-3xl font-bold my-6 scroll-mt-24">
        {children}
      </h1>
    );
  },
  heading2: ({ children, node }) => {
    const text = typeof children === "string" ? children :
      Array.isArray(children) ? children.join("") : "";
    const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    return (
      <h2 id={id} data-section={id} className="text-2xl font-semibold my-5 scroll-mt-24">
        {children}
      </h2>
    );
  },
  heading3: ({ children, node }) => {
    const text = typeof children === "string" ? children :
      Array.isArray(children) ? children.join("") : "";
    const id = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    return (
      <h3 id={id} data-section={id} className="text-xl font-semibold my-4 scroll-mt-24">
        {children}
      </h3>
    );
  },
  paragraph: ({ children }) => (
    <p className="my-4 leading-relaxed text-gray-700">{children}</p>
  ),
  preformatted: ({ children }) => (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg my-6 overflow-x-auto shadow-md">
      <code className="text-sm">{children}</code>
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  listItem: ({ children }) => (
    <li className="ml-6 list-disc text-gray-700">{children}</li>
  ),
  oListItem: ({ children }) => (
    <li className="ml-6 list-decimal text-gray-700">{children}</li>
  ),
  list: ({ children }) => <ul className="my-4 space-y-1">{children}</ul>,
  oList: ({ children }) => <ol className="my-4 space-y-1">{children}</ol>,
  hyperlink: ({ children, node }) => {
    const url = node.data.url ?? "";
    const target =
      typeof (node.data as any).target === "string"
        ? (node.data as any).target
        : "_self";
    const rel = target === "_blank" ? "noopener noreferrer" : undefined;

    return (
      <a
        href={url}
        target={target}
        rel={rel}
        className="text-blue-600 underline hover:text-blue-800 transition-colors"
      >
        {children}
      </a>
    );
  },
  label: ({ children, node }) => {
    if (node.data.label === "code") {
      return (
        <code className="bg-gray-100 text-gray-800 rounded px-2 py-1 font-mono text-sm">
          {children}
        </code>
      );
    }
    return <span>{children}</span>;
  },
};

// Table of Contents Component
function TableOfContents({
  headings,
  activeSection,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}: {
  headings: Array<{ id: string; text: string; level: number }>;
  activeSection: string;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}) {
  return (
    <>
      {/* Desktop TOC */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <nav className="sticky top-24 space-y-1">
          <div className="pb-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Table of Contents
            </h2>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border max-h-96 overflow-y-auto">
            {headings.length > 0 ? (
              <div className="space-y-1">
                {headings.map((heading) => (
                  <a
                    key={heading.id}
                    href={`#${heading.id}`}
                    className={`block text-sm transition-colors py-1 ${
                      heading.level === 1 ? "font-medium" :
                      heading.level === 2 ? "ml-2" : "ml-4"
                    } ${
                      activeSection === heading.id
                        ? "text-blue-700 font-medium"
                        : "text-gray-600 hover:text-blue-600"
                    }`}
                  >
                    {heading.text}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No headings found</p>
            )}
          </div>
        </nav>
      </div>

      {/* Mobile TOC */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="fixed top-16 left-0 right-0 bg-white border-t shadow-lg max-h-96 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Table of Contents</h3>
              {headings.length > 0 ? (
                <div className="space-y-2">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block text-sm transition-colors py-2 ${
                        heading.level === 1 ? "font-medium" :
                        heading.level === 2 ? "ml-2" : "ml-4"
                      } ${
                        activeSection === heading.id
                          ? "text-blue-700 font-medium"
                          : "text-gray-600 hover:text-blue-600"
                      }`}
                    >
                      {heading.text}
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No headings found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { uid } = await params;
  const client = createClient();

  try {
    const post = await client.getByUID("blog_posts", uid, {
      fetchOptions: { next: { tags: ["prismic"] } },
    });

    if (!post) return notFound();

    const headings = extractHeadings(post.data.content);

    return (
      <>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4001819101528400"
          crossOrigin="anonymous"
        ></script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateBlogPostStructuredData(post, uid)),
          }}
        />

        <BlogPostContent post={post} headings={headings} uid={uid} />
      </>
    );
  } catch (error) {
    console.error("Error fetching blog post:", error);
    notFound();
  }
}

// Client Component for interactive features
function BlogPostContent({
  post,
  headings,
  uid
}: {
  post: any;
  headings: Array<{ id: string; text: string; level: number }>;
  uid: string;
}) {
  const [activeSection, setActiveSection] = React.useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll("[data-section]");
      let currentSection = "";

      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 100 && rect.bottom >= 100) {
          currentSection = section.getAttribute("data-section") || "";
        }
      });

      if (currentSection && currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeSection]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile TOC Toggle Button */}
      <div className="lg:hidden fixed top-20 right-4 z-30">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="bg-white p-2 rounded-lg shadow-md border hover:shadow-lg transition-shadow"
          aria-label="Toggle table of contents"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pt-20">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
          <TableOfContents
            headings={headings}
            activeSection={activeSection}
            isMobileMenuOpen={isMobileMenuOpen}
            setIsMobileMenuOpen={setIsMobileMenuOpen}
          />

          {/* Main Content */}
          <div className="flex-1 max-w-4xl">
            <article className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {/* Article Header */}
              <div className="p-6 sm:p-8 border-b border-gray-100">
                <Link
                  href="/blog"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Blog
                </Link>

                <div className="mb-6">
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
                    <PrismicRichText field={post.data.title} />
                  </h1>

                  {post.data.excerpt && (
                    <div className="text-lg text-gray-600 mb-4">
                      <PrismicRichText field={post.data.excerpt} />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {post.data.author && (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        {post.data.author}
                      </span>
                    )}

                    {(post.data.published_date || post.first_publication_date) && (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(post.data.published_date || post.first_publication_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {post.data.featured_image?.url && (
                  <div className="mb-6">
                    <Image
                      src={post.data.featured_image.url}
                      alt={post.data.featured_image.alt || ""}
                      width={800}
                      height={400}
                      className="w-full h-64 sm:h-80 object-cover rounded-lg"
                      priority
                    />
                  </div>
                )}
              </div>

              {/* Article Content */}
              <div className="p-6 sm:p-8">
                <div className="prose prose-gray max-w-none">
                  <PrismicRichText
                    field={post.data.content}
                    components={richTextComponents}
                  />

                  <SliceZone
                    slices={post.data.slices}
                    components={{ dependency_cta: DependencyCta }}
                  />
                </div>
              </div>

              {/* Article Footer */}
              <div className="p-6 sm:p-8 bg-gray-50 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <Link
                    href="/blog"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    View More Articles
                  </Link>

                  <div className="text-sm text-gray-500">
                    Last updated: {new Date(post.last_publication_date || post.first_publication_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}