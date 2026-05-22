const { lemonSqueezySetup, createCheckout } = require('@lemonsqueezy/lemonsqueezy.js');

const LEMONSQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY || '';
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || '';
const PRO_VARIANT_ID = process.env.LEMONSQUEEZY_PRO_VARIANT_ID || '1658067';

if (LEMONSQUEEZY_API_KEY) {
  lemonSqueezySetup({
    apiKey: LEMONSQUEEZY_API_KEY,
    onError: (error) => console.error("LemonSqueezy Error:", error),
  });
}

function assertBillingConfig() {
  if (!LEMONSQUEEZY_API_KEY) {
    throw new Error('LEMONSQUEEZY_API_KEY is missing on the backend.');
  }
  if (!STORE_ID) {
    throw new Error('LEMONSQUEEZY_STORE_ID is missing on the backend.');
  }
  if (!PRO_VARIANT_ID) {
    throw new Error('LEMONSQUEEZY_PRO_VARIANT_ID is missing on the backend.');
  }
}

/**
 * Generate a LemonSqueezy Checkout URL for a specific user.
 * @param {string} userId - The Clerk User ID
 * @param {string} userEmail - The User's Email
 */
async function generateProCheckout(userId, userEmail) {
  try {
    assertBillingConfig();

    const { statusCode, error, data } = await createCheckout(STORE_ID, PRO_VARIANT_ID, {
      checkoutData: {
        email: userEmail,
        custom: {
          user_id: userId, // Pass the Clerk User ID as custom data to match it in webhooks
        },
      },
    });

    if (error) {
      throw new Error(`LemonSqueezy Error: ${error.message || error.cause || 'Unknown checkout failure'}`);
    }

    if (statusCode && statusCode >= 400) {
      throw new Error(`LemonSqueezy checkout request failed with status ${statusCode}.`);
    }

    if (!data?.data?.attributes?.url) {
      throw new Error('LemonSqueezy did not return a checkout URL.');
    }

    return data.data.attributes.url;
  } catch (err) {
    console.error("[BillingService] Failed to generate checkout:", err);
    throw err;
  }
}

module.exports = {
  generateProCheckout
};
