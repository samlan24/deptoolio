import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  // Parse Prismic webhook payload
  const body = await req.json();

  // Default: revalidate all Prismic content
  revalidateTag("prismic");

  // Optional: smarter revalidation by type
  // if (body.type === "api-update" && body.documents) {
  //   revalidateTag("prismic-posts");
  // }

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
