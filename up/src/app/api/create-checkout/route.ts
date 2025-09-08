// app/api/create-checkout/route.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Environment check:");
    console.log("API Key exists:", !!process.env.LEMON_SQUEEZY_API_KEY);
    console.log("Store ID:", process.env.LEMON_SQUEEZY_STORE_ID);
    console.log("Variant ID:", process.env.LEMON_SQUEEZY_VARIANT_ID);
    console.log("App URL:", process.env.NEXT_PUBLIC_APP_URL);

    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
              desc: true,
              discount: true,
            },
            checkout_data: {
              custom: {
                user_id: user.id,
              },
            },
            product_options: {
              name: "Pacgie Pro",
              description: "Monthly Pro subscription - 250 scans per month",
              redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
            },
          },
          relationships: {
            store: {
              data: {
                type: "stores",
                id: process.env.LEMON_SQUEEZY_STORE_ID,
              },
            },
            variant: {
              data: {
                type: "variants",
                id: process.env.LEMON_SQUEEZY_VARIANT_ID,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Lemon Squeezy API error:", error);
      throw new Error("Failed to create checkout");
    }

    const data = await response.json();

    return NextResponse.json({
      checkoutUrl: data.data.attributes.url,
    });
  } catch (error) {
    console.error("Checkout creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
