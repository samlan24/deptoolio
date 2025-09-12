import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrismicRichText } from "@prismicio/react";
import { createClient } from "@/prismicio";
import Link from "next/link";
import Image from "next/image";

const blogStructuredData = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Pacgie Security Blog",
  url: "https://www.pacgie.com/blog",
  description: "Expert security guides for developers. Learn dependency management, vulnerability prevention, and package security.",
  publisher: {
    "@type": "Organization",
    name: "Pacgie",
    url: "https://www.pacgie.com"
  },
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": "https://www.pacgie.com/blog"
  }
};

export default async function BlogPage() {
  const client = createClient();

  try {
    // Fetch the blog landing page content
    const page = await client.getSingle("pacgie_blog");

    // Fetch all blog posts, sorted by published date
    const blogPosts = await client.getAllByType("blog_posts", {
      orderings: [
        { field: "my.blog_post.published_date", direction: "desc" },
        { field: "document.first_publication_date", direction: "desc" },
      ],
    });

    // Separate featured post and regular posts
    const featuredPost = blogPosts.find((post) => post.data.featured_post);
    const regularPosts = blogPosts
      .filter((post) => !post.data.featured_post)
      .slice(0, 8);

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(blogStructuredData) }}
        />
      <div className="max-w-7xl mx-auto px-4 py-8 pt-20">
        {/* Page Header */}
        <div className="text-center mb-12">
          <PrismicRichText
            field={page.data.page_title}
            components={{
              heading1: ({ children }) => (
                <h1 className="text-4xl font-bold mb-4">{children}</h1>
              ),
            }}
          />

          <div className="text-lg text-gray-600 max-w-3xl mx-auto">
            <PrismicRichText field={page.data.hero_section} />
          </div>
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">Featured Guide</h2>
            <Link href={`/blog/${featuredPost.uid}`}>
              <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="md:flex">
                  <div className="md:w-1/2">
                    {featuredPost.data.featured_image?.url && (
                      <Image
                        src={featuredPost.data.featured_image.url}
                        alt={featuredPost.data.featured_image.alt || ""}
                        width={600}
                        height={400}
                        className="w-full h-64 md:h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="md:w-1/2 p-8">
                    <div className="flex items-center mb-3">
                      <span className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                        {featuredPost.data.category}
                      </span>
                      <span className="text-gray-500 text-sm ml-4">
                        {new Date(
                          featuredPost.data.published_date ||
                            featuredPost.first_publication_date
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-900">
                      <PrismicRichText field={featuredPost.data.title} />
                    </h3>
                    <div className="text-gray-600 mb-4">
                      <PrismicRichText field={featuredPost.data.excerpt} />
                    </div>
                    <p className="text-sm text-gray-800">
                      By {featuredPost.data.author}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Regular Posts Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Latest Guides</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularPosts.map((post) => (
              <Link key={post.uid} href={`/blog/${post.uid}`}>
                <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
                  {post.data.featured_image?.url && (
                    <Image
                      src={post.data.featured_image.url}
                      alt={post.data.featured_image.alt || ""}
                      width={400}
                      height={250}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      <span className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                        {post.data.category}
                      </span>
                      <span className="text-gray-500 text-sm ml-3">
                        {new Date(
                          post.data.published_date ||
                            post.first_publication_date
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg mb-2">
                      <PrismicRichText field={post.data.title} />
                    </h3>
                    <div className="text-gray-600 text-sm mb-4">
                      <PrismicRichText field={post.data.excerpt} />
                    </div>
                    <p className="text-xs text-gray-500">
                      By {post.data.author}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>
      </div>
      </>
    );
  } catch (error) {
    console.error("Error fetching blog data:", error);
    notFound();
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const client = createClient();

  try {
    const page = await client.getSingle("pacgie_blog");

    return {
      title:
        page.data.meta_title ||
        "Pacgie Security Blog - Dependency Management & Vulnerability Guides",
      description:
        page.data.meta_description ||
        "Expert security guides for developers. Learn dependency management, vulnerability prevention, and package security across Node.js, Python, PHP, Go, and more programming languages.",
      keywords: [
        "dependency security",
        "vulnerability management",
        "package security",
        "developer guides",
        "dependency scanning",
        "security best practices",
      ],
      openGraph: {
        title:
          page.data.meta_title ||
          "Pacgie Security Blog - Dependency Management & Vulnerability Guides",
        description:
          page.data.meta_description ||
          "Expert security guides for developers. Learn dependency management, vulnerability prevention, and package security across Node.js, Python, PHP, Go, and more programming languages.",
        type: "website",
        url: "https://www.pacgie.com/blog",
        siteName: "Pacgie",
        images: page.data.meta_image?.url ? [page.data.meta_image.url] : [],
      },
      twitter: {
        card: "summary_large_image",
        title: page.data.meta_title || "Pacgie Security Blog",
        description:
          page.data.meta_description || "Expert security guides for developers",
      },
      alternates: {
        canonical: "https://www.pacgie.com/blog",
      },
    };
  } catch (error) {
    return {
      title:
        "Pacgie Security Blog - Dependency Management & Vulnerability Guides",
      description:
        "Expert security guides for developers. Learn dependency management, vulnerability prevention, and package security across Node.js, Python, PHP, Go, and more programming languages.",
    };
  }
}
