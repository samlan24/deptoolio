import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrismicRichText } from "@prismicio/react";
import { SliceZone } from "@prismicio/react";
import { asText } from "@prismicio/helpers";
import { createClient } from "@/prismicio";
import Image from "next/image";
import Link from "next/link";

import DependencyCta  from "../../../slices/DependencyCta";

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

const components = {
  dependencyCta: DependencyCta,
  // Add other slice components here as needed
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateBlogPostStructuredData(post, uid)),
          }}
        />
        <article className="max-w-4xl mx-auto p-8 pt-20">
          <Link
            href="/blog"
            className="inline-block mb-6 text-blue-600 hover:underline"
          >
            ← Back to Blog
          </Link>
          <h1 className="text-4xl font-bold mb-6">
            <PrismicRichText field={post.data.title} />
          </h1>
          {post.data.featured_image?.url && (
            <Image
              src={post.data.featured_image.url}
              alt={post.data.featured_image.alt || ""}
              width={800}
              height={400}
              className="mb-6 object-cover"
            />
          )}
          <SliceZone slices={post.data.content} components={components} />
        </article>
      </>
    );
  } catch (error) {
    console.error("Error fetching blog post:", error);
    notFound();
  }
}
