const express = require('express');
const crypto = require('crypto');

const {
  upsertSubscription
} = require('../services/subscription_service');

const router = express.Router();

function verifyLemonSqueezyWebhook(req, res, next) {
  const signature = req.headers['x-signature'];
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!signature) {
    return res.status(401).json({ error: 'Unauthorized: Missing signature' });
  }

  if (!secret) {
    console.warn('[WEBHOOK] LEMONSQUEEZY_WEBHOOK_SECRET not defined in .env - bypassing verification');
    return next();
  }

  try {
    const rawBody = req.rawBody ? req.rawBody.toString('utf-8') : JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(rawBody).digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const digestBuffer = Buffer.from(digest, 'hex');

    if (sigBuffer.length !== digestBuffer.length) {
      console.warn('[WEBHOOK] Invalid signature length');
      return res.status(401).json({ error: 'Invalid signature length' });
    }

    const isValid = crypto.timingSafeEqual(sigBuffer, digestBuffer);

    if (!isValid) {
      console.warn('[WEBHOOK] Invalid signature — possible attack attempt');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('[WEBHOOK] Signature check error:', err.message);
    return res.status(500).json({ error: 'Verification failed' });
  }

  next();
}

router.post(
  '/lemonsqueezy-webhook',
  verifyLemonSqueezyWebhook,
  async (req, res) => {

    try {

      const eventName =
        req.body.meta?.event_name;

      const data =
        req.body.data;

      if (
        eventName ===
        'subscription_created'
      ) {

        const attributes =
          data.attributes;

        const userId =
          attributes.user_email;

        const email =
          attributes.user_email;

        const result =
          await upsertSubscription({
            user_id: userId,
            email,
            status: 'active',
            plan: 'pro'
          });

        console.log(
          'Subscription Created:',
          result
        );
      }

      res.status(200).send('OK');

    } catch (err) {

      console.error(err);

      res.status(500).send('Webhook Error');
    }
  }
);

module.exports = router;
