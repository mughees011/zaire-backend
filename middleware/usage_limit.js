const subscriptionService = require('../services/subscription_service');

async function usageLimit(req, res, next) {
    try {
        const userId = req.auth.userId;
        const sub = await subscriptionService.getSubscription(userId);

        if (!sub) {
            return res.status(403).json({ error: 'No subscription found' });
        }

        // We assume 'monthly_requests' tracks how many requests they have MADE
        // request_limit tracks how many they are ALLOWED
        if (sub.monthly_requests >= sub.request_limit && sub.request_limit !== -1) {
            const isBYOK = sub.request_limit === 0;
            return res.status(429).json({
                error: isBYOK 
                    ? 'BYOK Required: Please enter your API keys in Settings -> AI Vault.' 
                    : 'Monthly API limit reached. Please upgrade your plan or BYOK.',
                plan: sub.plan,
                limit: sub.request_limit
            });
        }

        // Increment usage
        await subscriptionService.incrementRequest(userId);

        next();
    } catch (err) {
        console.error("[USAGE LIMIT ERR]:", err);
        res.status(500).json({ error: 'Usage middleware failed' });
    }
}

module.exports = { usageLimit };