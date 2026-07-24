const pool = require('../db/db');

async function testDB() {

    try {

        const result = await pool.query('SELECT NOW()');

        console.log('Database Connected Successfully');
        console.log(result.rows);

    } catch (error) {

        console.error('Database Connection Failed');
        console.error(error);

    } finally {

        process.exit();
    }
}

testDB();