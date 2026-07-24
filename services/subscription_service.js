const crypto = require('crypto');
const pool = require('../db');

function generateLicenseKey() {

    const parts = [];

    for (let i = 0; i < 4; i++) {
        parts.push(
            crypto.randomBytes(2)
                .toString('hex')
                .toUpperCase()
        );
    }

    return `ZAIRE-${parts.join('-')}`;
}

async function getSubscription(userId) {

    const result = await pool.query(
        `
    SELECT *
    FROM subscriptions
    WHERE user_id = $1
    `,
        [userId]
    );

    let sub = result.rows[0];

    if (!sub) {
        // Automatically insert a new Free tier user record in DB on-the-fly!
        const licenseKey = generateLicenseKey();
        const insertResult = await pool.query(
            `
            INSERT INTO subscriptions
            (
                user_id,
                email,
                license_key,
                plan,
                status
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
            `,
            [
                userId,
                userId.includes('@') ? userId : `${userId}@zaire.local`,
                licenseKey,
                'free',
                'active'
            ]
        );
        sub = insertResult.rows[0];
        console.log(`[AUTOPROVISION] Registered new Free user in DB: ${userId}`);
    }

    // Attach virtual monthly_requests attribute to the returned subscription
    if (sub) {
        sub.monthly_requests = sub.plan === 'free' ? 500 : -1;
    }

    return sub;
}

async function getSubscriptionByLicenseKey(licenseKey) {

    const result = await pool.query(
        `
    SELECT *
    FROM subscriptions
    WHERE license_key = $1
    `,
        [licenseKey]
    );

    return result.rows[0];
}

async function upsertSubscription(data) {

    const existing =
        await getSubscription(data.user_id);

    if (existing) {

        const result = await pool.query(
            `
      UPDATE subscriptions
      SET
        email = $1,
        plan = $2,
        status = $3,
        updated_at = NOW()
      WHERE user_id = $4
      RETURNING *;
      `,
            [
                data.email,
                data.plan || 'pro',
                data.status || 'active',
                data.user_id
            ]
        );

        return result.rows[0];

    } else {

        const licenseKey =
            generateLicenseKey();

        const result = await pool.query(
            `
      INSERT INTO subscriptions
      (
        user_id,
        email,
        license_key,
        plan,
        status
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
      `,
            [
                data.user_id,
                data.email,
                licenseKey,
                data.plan || 'pro',
                data.status || 'active'
            ]
        );

        return result.rows[0];
    }
}

async function addMachine(
    licenseKey,
    machine
) {

    const sub =
        await getSubscriptionByLicenseKey(
            licenseKey
        );

    if (!sub) return false;

    const existing =
        await pool.query(
            `
      SELECT *
      FROM machines
      WHERE
        subscription_id = $1
        AND machine_fingerprint = $2
      `,
            [
                sub.id,
                machine.machine_id
            ]
        );

    if (existing.rows.length > 0) {

        await pool.query(
            `
      UPDATE machines
      SET activated_at = NOW()
      WHERE id = $1
      `,
            [existing.rows[0].id]
        );

    } else {

        const machineCount =
            await pool.query(
                `
        SELECT COUNT(*)
        FROM machines
        WHERE subscription_id = $1
        `,
                [sub.id]
            );

        const count =
            parseInt(
                machineCount.rows[0].count
            );

        if (count >= sub.machine_limit) {
            return false;
        }

        await pool.query(
            `
      INSERT INTO machines
      (
        subscription_id,
        machine_fingerprint,
        machine_name,
        os_info
      )
      VALUES ($1, $2, $3, $4)
      `,
            [
                sub.id,
                machine.machine_id,
                machine.machine_name || 'Unknown',
                machine.os || 'Unknown'
            ]
        );
    }

    return true;
}

async function deactivateMachine(
    licenseKey,
    machineId
) {

    const sub =
        await getSubscriptionByLicenseKey(
            licenseKey
        );

    if (!sub) return false;

    await pool.query(
        `
    DELETE FROM machines
    WHERE
      subscription_id = $1
      AND machine_fingerprint = $2
    `,
        [
            sub.id,
            machineId
        ]
    );

    return true;
}

module.exports = {
    getSubscription,
    getSubscriptionByLicenseKey,
    upsertSubscription,
    addMachine,
    deactivateMachine,
    generateLicenseKey
};