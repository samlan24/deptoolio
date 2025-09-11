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
    console.error("Webhook processing failed:", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}

async function handleSubscriptionCreated(subscription: any, meta: any) {
  const userId =
    meta.custom_data?.user_id ||
    subscription.attributes?.checkout_data?.custom?.user_id ||
    subscription.attributes?.custom?.user_id;

  if (!userId) {
    console.log("No userId found, skipping");
    return;
  }

  // Store full timestamps instead of just dates
  const renewsAt = subscription.attributes.renews_at;
  const createdAt = subscription.attributes.created_at;

  const insertData = {
    user_id: userId,
    lemon_squeezy_id: subscription.id,
    status: subscription.attributes.status,
    plan: "pro",
    scan_limit: 250,
    period_start: createdAt,    // Full timestamp
    period_end: renewsAt,       // Full timestamp
  };

  // Use user_id for conflict resolution since it has a unique constraint
  const { data, error } = await supabase
    .from("subscriptions")
    .upsert(insertData, { onConflict: "user_id" })
    .select();

  if (error) {
    console.error("Subscription creation failed:", {
      subscriptionId: subscription.id,
      message: error.message,
    });
    throw error;
  } else {
    console.log("Successfully inserted/updated subscription:");
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  // Store full timestamp instead of just date
  const renewsAt = subscription.attributes.renews_at;
  const updateData: any = {
    status: subscription.attributes.status,
  };

  // Update period_end with full timestamp if we have a new renews_at
  if (renewsAt) {
    updateData.period_end = renewsAt;  // Full timestamp
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Subscription update failed:", {
      subscriptionId: subscription.id,
      message: error.message,
    });
    throw error;
  } else {
    console.log("Successfully updated subscription:");
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  // When cancelled, user keeps access until period_end
  // Use ends_at for cancelled subscriptions (more accurate than renews_at)
  const endsAt = subscription.attributes.ends_at;

  const updateData: any = {
    status: "cancelled",
  };

  // Update period_end to the exact cancellation end time if available
  if (endsAt) {
    updateData.period_end = endsAt;  // Full timestamp
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Cancel error");
    throw error;
  } else {
    console.log("Successfully cancelled subscription:");
  }
}

async function handleSubscriptionResumed(subscription: any) {
  const renewsAt = subscription.attributes.renews_at;

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      period_end: renewsAt,  // Full timestamp
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Subscription resume failed:", {
      subscriptionId: subscription.id,
      message: error.message,
    });
    throw error;
  } else {
    console.log("Successfully resumed subscription:");
  }
}

async function handleSubscriptionExpired(subscription: any) {
  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "expired",
      // period_end stays the same - shows when it actually expired
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Subscription expiration failed:", {
      subscriptionId: subscription.id,
      message: error.message,
    });
    throw error;
  } else {
    console.log("Successfully expired subscription:");
  }
}

async function handlePaymentSuccess(invoiceData: any) {
  const subscriptionId = invoiceData.attributes.subscription_id;

  // Fetch the actual subscription data from Lemon Squeezy API
  try {
    const subscriptionResponse = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
          Accept: "application/vnd.api+json",
        },
      }
    );

    if (!subscriptionResponse.ok) {
      console.error("Failed to fetch subscription data");
      return;
    }

    const subscriptionData = await subscriptionResponse.json();
    const subscription = subscriptionData.data;

    // Now we can safely access renews_at
    const renewsAt = subscription.attributes.renews_at;

    if (!renewsAt) {
      console.error("Missing renews_at in subscription data");
      return;
    }

    // Validate that renewsAt is a valid timestamp
    const renewsAtDate = new Date(renewsAt);
    if (isNaN(renewsAtDate.getTime())) {
      console.error("Invalid renews_at date:", renewsAt);
      return;
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        period_end: renewsAt,  // Store full timestamp
        updated_at: new Date().toISOString(),
      })
      .eq("lemon_squeezy_id", subscriptionId);

    if (error) {
      console.error("Payment success update error");
      throw error;
    } else {
      console.log("Successfully updated subscription after payment:");
    }
  } catch (fetchError) {
    console.error("Subscription fetch failed:", {
      subscriptionId,
      message:
        fetchError instanceof Error ? fetchError.message : "Unknown error",
    });
    throw fetchError;
  }
}

async function handlePaymentFailed(subscription: any) {
  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      // Don't change period_end - user might still have grace period access
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Payment failed update error:", {
      subscriptionId: subscription.id,
      message: error.message,
    });
    throw error;
  } else {
    console.log("Successfully updated subscription after failed payment:");
  }
}