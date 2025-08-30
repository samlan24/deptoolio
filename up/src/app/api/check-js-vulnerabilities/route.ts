import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { dependencies } = await request.json();

    if (!dependencies || typeof dependencies !== "object") {
      return NextResponse.json({ error: "Dependencies required" }, { status: 400 });
    }

    const auditPayload = {
      name: "vulnerability-audit",
      version: "1.0.0",
      requires: dependencies,
      dependencies: Object.fromEntries(
        Object.entries(dependencies).map(([pkg, version]) => [pkg, { version }])
      ),
    };

    const response = await fetch("https://registry.npmjs.org/-/npm/v1/security/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(auditPayload),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch audit report" }, { status: 500 });
    }

    const auditReport = await response.json();

    return NextResponse.json(auditReport);
  } catch (error) {
    console.error("Error in vulnerability scan:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
