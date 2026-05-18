const {
    upsertSubscription,
    getSubscription
} = require('./subscription_service2');

async function test() {

    const sub =
        await upsertSubscription({
            user_id: 'user_001',
            email: 'test@zaire.ai',
            plan: 'pro'
        });

    console.log(sub);

    const fetched =
        await getSubscription('user_001');

    console.log(fetched);

    process.exit();
}

test();