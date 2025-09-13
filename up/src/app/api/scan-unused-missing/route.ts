import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, path } = await request.json();

    if (!owner || !repo || !path) {
      return NextResponse.json(
        { error: "Missing owner, repo, or path" },
        { status: 400 }
      );
    }

    // Send request to your microservice scan endpoint
    const response = await fetch(
      "https://deptoolio-services-production.up.railway.app/scan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, path }),
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      return NextResponse.json(
        { error: errData.error || "Scan failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}
