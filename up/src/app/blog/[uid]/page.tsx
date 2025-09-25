import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrismicRichText, JSXMapSerializer } from "@prismicio/react";
import { SliceZone } from "@prismicio/react";
import { asText } from "@prismicio/helpers";
import { createClient } from "@/prismicio";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import DependencyCta from "../../../slices/DependencyCta";

interface Props {
  params: Promise<{ uid: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const router = useRouter();
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

const richTextComponents: JSXMapSerializer = {
  heading1: ({ children }) => (
    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
      {children}
    </h1>
  ),
  heading2: ({ children }) => (
    <h2 className="text-2xl text-gray-900 font-semibold my-5">{children}</h2>
  ),
  heading3: ({ children }) => (
    <h3 className="text-xl text-gray-900 font-semibold my-4">{children}</h3>
  ),
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

export default async function BlogPostPage({ params }: Props) {
  const { uid } = await params;
  const client = createClient();

  try {
    const post = await client.getByUID("blog_posts", uid, {
      fetchOptions: { next: { tags: ["prismic"] } },
    });

    if (!post) return notFound();

    return (
      <>
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4001819101528400"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateBlogPostStructuredData(post, uid)),
          }}
        />

        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pt-20">
            <article className="bg-white rounded-lg shadow-sm border overflow-hidden">
              {/* Article Header */}
              <div className="p-6 sm:p-8 border-b border-gray-100">
                <Link
                  href="/blog"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-6 text-sm font-medium transition-colors"
                >
                  {/* SVG and text */}
                  Back to Blog
                </Link>


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

                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    {post.data.author && (
                      <span className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {post.data.author}
                      </span>
                    )}

                    {(post.data.published_date ||
                      post.first_publication_date) && (
                      <span className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {new Date(
                          post.data.published_date ||
                            post.first_publication_date
                        ).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
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
                    components={{
                      dependency_cta: (props) => (
                        <DependencyCta {...props} lightMode={true} />
                      ),
                    }}
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
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    View More Articles
                  </Link>

                  <div className="text-sm text-gray-500">
                    Last updated:{" "}
                    {new Date(
                      post.last_publication_date || post.first_publication_date
                    ).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error("Error fetching blog post:", error);
    notFound();
  }
}
