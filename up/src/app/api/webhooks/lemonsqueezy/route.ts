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
      case "subscription_resumed":
        await handleSubscriptionResumed(subscription);
        break;
      case "subscription_expired":
        await handleSubscriptionExpired(subscription);
        break;
      case "subscription_payment_success":
        await handlePaymentSuccess(subscription);
        break;
      case "subscription_payment_failed":
        await handlePaymentFailed(subscription);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
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

  // Use user_id for conflict resolution since it has a unique constraint
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

  // Calculate new period end from renews_at if it exists
  const renewsAt = subscription.attributes.renews_at;
  const updateData: any = {
    status: subscription.attributes.status,
  };

  // Update period_end if we have a new renews_at date
  if (renewsAt) {
    updateData.period_end = new Date(renewsAt).toISOString().split("T")[0];
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updateData)
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

  // When cancelled, user keeps access until period_end
  // Don't change the period_end, just update status
  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "cancelled",
      // Keep existing period_end - user has access until then
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

async function handleSubscriptionResumed(subscription: any) {
  console.log("Resuming subscription:", subscription.id);

  const renewsAt = new Date(subscription.attributes.renews_at);
  const periodEnd = renewsAt.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      period_end: periodEnd,
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Resume error:", error);
    throw error;
  } else {
    console.log("Successfully resumed subscription:", data);
  }
}

async function handleSubscriptionExpired(subscription: any) {
  console.log("Expiring subscription:", subscription.id);

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "expired",
      // period_end stays the same - shows when it actually expired
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Expire error:", error);
    throw error;
  } else {
    console.log("Successfully expired subscription:", data);
  }
}

async function handlePaymentSuccess(subscription: any) {
  console.log("Payment successful for subscription:", subscription.id);

  // Successful payment - extend the period
  const renewsAt = new Date(subscription.attributes.renews_at);
  const periodEnd = renewsAt.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      period_end: periodEnd,
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Payment success update error:", error);
    throw error;
  } else {
    console.log("Successfully updated subscription after payment:", data);
  }
}

async function handlePaymentFailed(subscription: any) {
  console.log("Payment failed for subscription:", subscription.id);

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      // Don't change period_end - user might still have grace period access
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Payment failed update error:", error);
    throw error;
  } else {
    console.log(
      "Successfully updated subscription after failed payment:",
      data
    );
  }
}
