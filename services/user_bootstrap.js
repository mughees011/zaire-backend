const { getSubscription, upsertSubscription } = require('./subscription_service');

async function bootstrapUser(user) {
  const existingSub = await getSubscription(user.id);
  
  if (!existingSub) {
    return await upsertSubscription({
      user_id: user.id,
      email: user.email,
      plan: 'free',
      status: 'active'
    });
  }
  
  // Just update email if needed, do NOT overwrite plan or status
  return await upsertSubscription({
    user_id: user.id,
    email: user.email
  });
}

module.exports = {
  bootstrapUser
};
