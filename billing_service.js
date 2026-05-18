const { lemonSqueezySetup, createCheckout } = require('@lemonsqueezy/lemonsqueezy.js');

const LEMONSQUEEZY_API_KEY = process.env.LEMONSQUEEZY_API_KEY || "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGQ1OWNlZi1kYmI4LTRlYTUtYjE3OC1kMjU0MGZjZDY5MTkiLCJqdGkiOiI4YzNkZWYwNDRlMWFhZWRjMTExNTZmNDBhYzE3NWI3ZWI1ZDZjYzExMTNjYzM0NzY5MTZiMjQyM2U1YzBlMWZmMDg2ZDE0Y2MzNGVlM2YzZSIsImlhdCI6MTc3ODgzMDQ3OS45Mjk1ODUsIm5iZiI6MTc3ODgzMDQ3OS45Mjk1ODgsImV4cCI6MTc5NTk5NjgwMC4wMzQ5MjksInN1YiI6IjcxMDE5MDQiLCJzY29wZXMiOltdfQ.JW9pSKD8oMsjc_rRVuh0NB8R3whJuGL46olzj5fPhNSFM-brNq0pm__RWVFGA1vkkJ9JTrGQp5J9IHr4w3Rjhy7-waX7Wc2Nwrcqr3qURTFqSkUeo7lEqe1L8Lo3HnG1EyhqYwc29L5h7uJnHQqbZws61x67rFsbNSpB7wBdrtLy8_c4SLBQ3bQVMKo0rChxfrC4cxw1WJ7ekXSPIv0hFFyTurcX9cw66EUtpN3x1oZY0tWoNJ6fWmTLuYnulP_aokr43tgpuS5433lZwJHvl8AKJOU2DqWihL9ZDTsJW0QZga-jAOa5DI1ajoTPcprAqRf097A5-aeWs7rDhcn4tVLWnOjDxv5EVh-EDwoCCnv47-WBgq5POetFeKvsdWy3l0bK_kRE9pH8H__gwiQgbVylnVslGHLnZxgbJk-jTDWOSCgEvhL_INDfhfBVsAApKUI7028lnjkqChKyn4aIHrvHJiWklmcyOibZNuRjiHU_DqFhkPdzlJHqQ5XdkSnJNFQ8uBtLeKTnyn3LePxt34WEyfhLsw5qbU89entWL2w9KZQ1cXNqU8ZedcbEuphgd2riEdeo0yWDOUNB-K1BSW-1jRrnWljQeR78Q_vfiS_XvBECfIFZJ4OmWosFBKX9DDiulcf27OhxaQVuHiuvYGclKaJmamTITKT0nHn2jPo";
const STORE_ID = process.env.LEMONSQUEEZY_STORE_ID || "12345"; // Requires store ID to create checkout
const PRO_VARIANT_ID = "1658067"; // User provided this

// Initialize LemonSqueezy
lemonSqueezySetup({
  apiKey: LEMONSQUEEZY_API_KEY,
  onError: (error) => console.error("LemonSqueezy Error:", error),
});

/**
 * Generate a LemonSqueezy Checkout URL for a specific user.
 * @param {string} userId - The Clerk User ID
 * @param {string} userEmail - The User's Email
 */
async function generateProCheckout(userId, userEmail) {
  try {
    const { statusCode, error, data } = await createCheckout(STORE_ID, PRO_VARIANT_ID, {
      checkoutData: {
        email: userEmail,
        custom: {
          user_id: userId, // Pass the Clerk User ID as custom data to match it in webhooks
        },
      },
    });

    if (error) {
      throw new Error(`LemonSqueezy Error: ${error.message}`);
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
