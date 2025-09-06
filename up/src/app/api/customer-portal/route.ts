import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get the auth token from request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: "No auth token provided" }, { status: 401 });
    }

    // Verify the token and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
    }

    // Get user's subscription
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("lemon_squeezy_id")
      .eq("user_id", user.id)
      .single();

    if (error || !subscription?.lemon_squeezy_id) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    // Get customer portal URL from LemonSqueezy
    const portalUrl = await getCustomerPortalUrl(subscription.lemon_squeezy_id);

    return NextResponse.json({ url: portalUrl });

  } catch (error) {
    console.error("Customer portal error:", error);
    return NextResponse.json({ error: "Failed to get portal URL" }, { status: 500 });
  }
}

async function getCustomerPortalUrl(lemonSqueezyId: string) {
  const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${lemonSqueezyId}/customer-portal`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    }
  });

  if (!response.ok) {
    throw new Error(`LemonSqueezy API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data.attributes.url;
}