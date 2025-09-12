'use client';

import { useState } from 'react';
import Link from "next/link";
import Image from "next/image";
import { PrismicRichText } from "@prismicio/react";

interface BlogListProps {
  posts: any[];
}

export default function BlogList({ posts }: BlogListProps) {
  const [visibleCount, setVisibleCount] = useState(8);

  const loadMore = () => {
    setVisibleCount(prev => prev + 6);
  };

  const visiblePosts = posts.slice(0, visibleCount);
  const hasMore = visibleCount < posts.length;

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Latest Guides</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visiblePosts.map((post) => (
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
                    {post.data.category || "Uncategorized"}
                  </span>
                  <span className="text-gray-500 text-sm ml-3">
                    {new Date(
                      post.data.published_date ||
                        post.first_publication_date
                    ).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-2 text-black">
                  <PrismicRichText field={post.data.title} />
                </h3>
                <div className="text-gray-600 text-sm mb-4">
                  <PrismicRichText field={post.data.excerpt} />
                </div>
                <p className="text-xs text-gray-500">
                  By {post.data.author || "Anonymous"}
                </p>
              </div>
            </article>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-8">
          <button
            onClick={loadMore}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          >
            Load More Posts
          </button>
        </div>
      )}
    </div>
  );
}