const express = require('express');
const crypto = require('crypto');

const {
  upsertSubscription
} = require('../subscription_service');

const router = express.Router();

router.post(
  '/lemonsqueezy-webhook',
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
