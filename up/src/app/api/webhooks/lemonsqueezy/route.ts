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

    console.log("Webhook received - eventType:", eventType);

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
  console.log(
    "Webhook received - subscription:",
    JSON.stringify(subscription, null, 2)
  );
  console.log("Webhook received - meta:", JSON.stringify(meta, null, 2));

  const userId =
    meta.custom_data?.user_id ||
    subscription.attributes?.checkout_data?.custom?.user_id ||
    subscription.attributes?.custom?.user_id;

  console.log("Extracted userId:", userId);

  if (!userId) {
    console.log("No userId found, skipping");
    return;
  }

  // Calculate period dates from renews_at
  const renewsAt = new Date(subscription.attributes.renews_at);
  const createdAt = new Date(subscription.attributes.created_at);

  // For monthly subscription, period_start is created_at, period_end is renews_at
  const periodStart = createdAt.toISOString().split("T")[0];
  const periodEnd = renewsAt.toISOString().split("T")[0];

  const insertData = {
    user_id: userId,
    lemon_squeezy_id: subscription.id,
    status: subscription.attributes.status,
    plan: "pro",
    scan_limit: 250,
    period_start: periodStart,
    period_end: periodEnd,
  };

  console.log("Attempting to insert:", insertData);

  // Use lemon_squeezy_id for conflict resolution since it has a unique constraint
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(insertData, { onConflict: "user_id" })
    .select();

  if (error) {
    console.error("Database error:", error);
    throw error;
  } else {
    console.log("Successfully inserted/updated subscription:", data);
  }
}
async function handleSubscriptionUpdated(subscription: any) {
  console.log("Updating subscription:", subscription.id);

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: subscription.attributes.status,
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Update error:", error);
    throw error;
  } else {
    console.log("Successfully updated subscription:", data);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  console.log("Cancelling subscription:", subscription.id);

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Cancel error:", error);
    throw error;
  } else {
    console.log("Successfully cancelled subscription:", data);
  }
}
