import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function POST(req: Request) {
  const body = await req.json();

  if (body.secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: "Invalid secret" }, { status: 401 });
  }

  // Revalidate everything tagged "prismic"
  revalidateTag("prismic");

  return NextResponse.json({
    revalidated: true,
    now: Date.now(),
    documents: body.documents,
  });
}
