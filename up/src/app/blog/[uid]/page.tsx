import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrismicRichText } from "@prismicio/react";
import { asText } from "@prismicio/helpers";
import { createClient } from "@/prismicio";
import Image from "next/image";
import Link from "next/link";

interface Props {
  params: Promise<{ uid: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { uid } = await params; // Await the params here
  const client = createClient();
  try {
    const post = await client.getByUID("blog_posts", uid);
    return {
      title: asText(post.data.meta_title) || "Blog Post",
      description: asText(post.data.meta_description) || "",
    };
  } catch {
    return {
      title: "Blog Post",
      description: "",
    };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { uid } = await params; // Await the params here too
  const client = createClient();

  try {
    const post = await client.getByUID("blog_posts", uid);
    if (!post) return notFound();

    return (
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
        <PrismicRichText field={post.data.content} />
      </article>
    );
  } catch (error) {
    console.error("Error fetching blog post:", error);
    notFound();
  }
}
