import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get the auth token from request headers
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "No auth token provided" },
        { status: 401 }
      );
    }

    // Verify the token and get user
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid auth token" },
        { status: 401 }
      );
    }

    // Get user's subscription
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("lemon_squeezy_id")
      .eq("user_id", user.id)
      .single();

    console.log(
      "Found subscription with LemonSqueezy ID:",
      subscription?.lemon_squeezy_id
    );

    if (error || !subscription?.lemon_squeezy_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Get customer portal URL from LemonSqueezy
    const portalUrl = await getCustomerPortalUrl(subscription.lemon_squeezy_id);

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error("Customer portal error:", error);
    return NextResponse.json(
      { error: "Failed to get portal URL" },
      { status: 500 }
    );
  }
}

async function getCustomerPortalUrl(lemonSqueezyId: string) {
  console.log("Retrieving subscription for portal URL:", lemonSqueezyId);

  // GET the subscription to access the urls.customer_portal
  const response = await fetch(
    `https://api.lemonsqueezy.com/v1/subscriptions/${lemonSqueezyId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        Accept: "application/vnd.api+json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LemonSqueezy API error:", {
      status: response.status,
      statusText: response.statusText,
      body: errorText,
      subscriptionId: lemonSqueezyId,
    });
    throw new Error(
      `LemonSqueezy API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  const portalUrl = data.data.attributes.urls?.customer_portal;

  if (!portalUrl) {
    throw new Error("No customer portal URL available for this subscription");
  }

  console.log("Successfully got portal URL");
  return portalUrl;
}
