import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-signature");

    // Verify webhook signature
    const hash = crypto
      .createHmac("sha256", process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!)
      .update(body)
      .digest("hex");

    if (signature !== hash) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const eventType = event.meta.event_name;
    const subscription = event.data;

    switch (eventType) {
      case "subscription_created":
        await handleSubscriptionCreated(subscription, event.meta);
        break;
      case "subscription_updated":
        await handleSubscriptionUpdated(subscription);
        break;
      case "subscription_cancelled":
        await handleSubscriptionCancelled(subscription);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

async function handleSubscriptionCreated(subscription: any, meta: any) {
  const userId = meta.custom_data?.user_id;

  if (!userId) return;

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    lemon_squeezy_id: subscription.id,
    status: subscription.attributes.status,
    plan: "pro", // Add this - your table has 'plan' column
    scan_limit: 250, // Add this - your table has 'scan_limit' column
    plan_type: "pro",
    period_start: new Date(subscription.attributes.current_period_start)
      .toISOString()
      .split("T")[0], // Convert to date format
    period_end: new Date(subscription.attributes.current_period_end)
      .toISOString()
      .split("T")[0], // Convert to date format
    current_period_start: subscription.attributes.current_period_start,
    current_period_end: subscription.attributes.current_period_end,
  });
}

async function handleSubscriptionUpdated(subscription: any) {
  await supabase
    .from("subscriptions")
    .update({
      status: subscription.attributes.status,
      current_period_start: subscription.attributes.current_period_start,
      current_period_end: subscription.attributes.current_period_end,
    })
    .eq("lemon_squeezy_id", subscription.id);
}

async function handleSubscriptionCancelled(subscription: any) {
  await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
    })
    .eq("lemon_squeezy_id", subscription.id);
}
