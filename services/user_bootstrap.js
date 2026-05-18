const { upsertSubscription } = require('../subscription_service');

async function bootstrapUser(user) {
  return await upsertSubscription({
    user_id: user.id,
    email: user.email,
    plan: 'free',
    status: 'active'
  });
}

module.exports = {
  bootstrapUser
};
