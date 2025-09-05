import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { planId, priceId } = await request.json();

    // Replace with your actual Lemon Squeezy integration
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LEMON_SQUEEZY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_options: {
              embed: false,
              media: false,
              logo: true,
            },
            checkout_data: {
              email: 'user@example.com', // Get from user session
            },
            product_options: {
              name: 'Pacgie Pro',
              description: 'Monthly Pro subscription',
              media: ['https://your-domain.com/logo.png'],
            },
            expires_at: null,
          },
          relationships: {
            store: {
              data: {
                type: 'stores',
                id: process.env.LEMON_SQUEEZY_STORE_ID,
              },
            },
            variant: {
              data: {
                type: 'variants',
                id: priceId,
              },
            },
          },
        },
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      checkoutUrl: data.data.attributes.url
    });
  } catch (error) {
    console.error('Checkout creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}