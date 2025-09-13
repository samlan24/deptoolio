import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;

    const response = await fetch(`${process.env.DEPCHECK_SERVICE_URL}/scan/${jobId}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to check scan status" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check scan status" },
      { status: 500 }
    );
  }
}