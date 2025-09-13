import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Security validation functions
async function validateSubscriptionOwnership(subscriptionId: string, userId: string): Promise<boolean> {
  try {
    // Check if this user actually owns this subscription
    const { data, error } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('lemon_squeezy_id', subscriptionId)
      .single();

    if (error || !data) {
      console.error('Subscription not found:', subscriptionId);
      return false;
    }

    return data.user_id === userId;
  } catch (error) {
    console.error('Ownership validation failed:', error);
    return false;
  }
}

function validateWebhookData(subscription: any, userId: string): boolean {
  if (!subscription?.id || !subscription?.attributes) {
    console.error('Invalid subscription data structure');
    return false;
  }

  if (!userId || typeof userId !== 'string') {
    console.error('Invalid or missing user_id');
    return false;
  }

  // Validate subscription ID format (Lemon Squeezy uses numeric IDs)
  if (!/^\d+$/.test(subscription.id)) {
    console.error('Invalid subscription ID format:', subscription.id);
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Basic rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Check if this IP has made too many requests recently
    const { data: recentRequests } = await supabase
      .from('webhook_events')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute
      .limit(10);

    if (recentRequests && recentRequests.length > 5) {
      console.warn('Rate limit exceeded for IP:', clientIP);
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

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

    // Duplicate event protection
    const eventId = event.meta.webhook_id;

    // Check if we've already processed this event
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('webhook_id', eventId)
      .single();

    if (existingEvent) {
      return NextResponse.json({ message: "Event already processed" });
    }

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
      case "subscription_payment_recovery_failed":
        await handleSubscriptionUnpaid(subscription);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Record that we've processed this event
    await supabase
      .from('webhook_events')
      .insert({
        webhook_id: eventId,
        processed_at: new Date().toISOString(),
        ip_address: clientIP
      });

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

  // Add validation
  if (!validateWebhookData(subscription, userId)) {
    throw new Error('Invalid webhook data');
  }

  // Check for existing subscription to prevent hijacking
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (existingSub && existingSub.user_id !== userId) {
    throw new Error('Subscription ownership mismatch');
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
    console.log("Successfully inserted/updated subscription for user:", userId);
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for update');
  }

  if (!validateWebhookData(subscription, subData.user_id)) {
    throw new Error('Invalid webhook data');
  }

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
    console.log("Successfully updated subscription:", subscription.id);
  }
}

async function handleSubscriptionCancelled(subscription: any) {
  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for cancellation');
  }

  if (!validateWebhookData(subscription, subData.user_id)) {
    throw new Error('Invalid webhook data');
  }

  // When cancelled, user keeps access until period_end
  // Use ends_at for cancelled subscriptions (more accurate than renews_at)
  const endsAt = subscription.attributes.ends_at;
  const now = new Date();
  const endDate = new Date(endsAt);

  const updateData: any = {
    status: "cancelled",
  };

  // Update period_end to the exact cancellation end time if available
  if (endsAt) {
    updateData.period_end = endsAt;  // Full timestamp
  }

  // If the cancellation is effective immediately (end date has passed)
  if (endDate <= now) {
    updateData.plan = "free";
    updateData.scan_limit = 10; // Free tier limit
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updateData)
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Cancel error:", error.message);
    throw error;
  } else {
    console.log("Successfully cancelled subscription:", subscription.id);
  }
}

async function handleSubscriptionResumed(subscription: any) {
  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for resume');
  }

  if (!validateWebhookData(subscription, subData.user_id)) {
    throw new Error('Invalid webhook data');
  }

  const renewsAt = subscription.attributes.renews_at;

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      plan: "pro", // Upgrade back to pro
      scan_limit: 250, // Restore pro limits
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
    console.log("Successfully resumed subscription:", subscription.id);
  }
}

async function handleSubscriptionExpired(subscription: any) {
  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for expiration');
  }

  if (!validateWebhookData(subscription, subData.user_id)) {
    throw new Error('Invalid webhook data');
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "expired",
      plan: "free", // Downgrade to free
      scan_limit: 10, // Free tier limit
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
    console.log("Successfully expired subscription and downgraded to free:", subscription.id);
  }
}

async function handlePaymentSuccess(invoiceData: any) {
  const subscriptionId = invoiceData.attributes.subscription_id;

  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscriptionId)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for payment success');
  }

  // Fetch the actual subscription data from Lemon Squeezy API
  try {
    // Request timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const subscriptionResponse = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`,
      {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
          Accept: "application/vnd.api+json",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!subscriptionResponse.ok) {
      console.error("Failed to fetch subscription data");
      return;
    }

    const subscriptionData = await subscriptionResponse.json();
    const subscription = subscriptionData.data;

    if (!validateWebhookData(subscription, subData.user_id)) {
      throw new Error('Invalid subscription data from API');
    }

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
        plan: "pro", // Ensure they're back on pro
        scan_limit: 250, // Restore pro limits
        period_end: renewsAt,  // Store full timestamp
        updated_at: new Date().toISOString(),
      })
      .eq("lemon_squeezy_id", subscriptionId);

    if (error) {
      console.error("Payment success update error:", error.message);
      throw error;
    } else {
      console.log("Successfully updated subscription after payment:", subscriptionId);
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
  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for payment failure');
  }

  if (!validateWebhookData(subscription, subData.user_id)) {
    throw new Error('Invalid webhook data');
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "past_due",
      // Don't change plan/scan_limit yet - user might still have grace period access
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
    console.log("Successfully updated subscription after failed payment:", subscription.id);
  }
}

async function handleSubscriptionUnpaid(subscription: any) {
  // Get the user_id for this subscription first
  const { data: subData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('lemon_squeezy_id', subscription.id)
    .single();

  if (fetchError || !subData) {
    throw new Error('Subscription not found for unpaid status');
  }

  if (!validateWebhookData(subscription, subData.user_id)) {
    throw new Error('Invalid webhook data');
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "unpaid",
      plan: "free", // Downgrade to free after all payment retries failed
      scan_limit: 10, // Free tier limit
    })
    .eq("lemon_squeezy_id", subscription.id)
    .select();

  if (error) {
    console.error("Subscription unpaid update failed:", {
      subscriptionId: subscription.id,
      message: error.message,
    });
    throw error;
  } else {
    console.log("Successfully marked subscription unpaid and downgraded to free:", subscription.id);
  }
}