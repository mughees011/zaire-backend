const pool = require('../db');

async function usageLimit(req, res, next) {

    try {

        const userId = req.auth.userId;

        const result = await pool.query(
            `
      SELECT *
      FROM subscriptions
      WHERE user_id = $1
      `,
            [userId]
        );

        const sub = result.rows[0];

        if (!sub) {

            return res.status(403).json({
                error: 'No subscription found'
            });
        }

        if (
            sub.monthly_requests >=
            sub.request_limit
        ) {

            return res.status(429).json({
                error: 'Monthly limit reached'
            });
        }

        await pool.query(
            `
      UPDATE subscriptions
      SET monthly_requests =
      monthly_requests + 1
      WHERE user_id = $1
      `,
            [userId]
        );

        next();

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: 'Usage middleware failed'
        });
    }
}

module.exports = {
    usageLimit
};