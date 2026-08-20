const http = require('http');
const { app, pool } = require('../index');

async function runTests() {
  console.log('--- CLARIFICATION ROUTE TESTS ---\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  function makeRequest(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/engineer/clarify',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      const req = http.request(options, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  try {
    console.log('[TEST 1] Highly Specific Prompt (Should Pass)');
    const res1 = await makeRequest({ what: "Build a SaaS dashboard for real estate agents using Next.js, dark mode, Stripe payments, and a PostgreSQL database. It needs a login page and a metrics overview." });
    
    console.log('Result:', JSON.stringify(res1, null, 2));
    console.assert(res1.needsClarification === false, 'Test 1 Failed: Should not need clarification.');
    console.log(res1.needsClarification === false ? '✓ Passed\n' : '✗ Failed\n');

    console.log('[TEST 2] Highly Vague Prompt (Should Ask Questions)');
    const res2 = await makeRequest({ what: "Make a cool website for my dog." });
    
    console.log('Result:', JSON.stringify(res2, null, 2));
    console.assert(res2.needsClarification === true, 'Test 2 Failed: Should need clarification.');
    console.assert(Array.isArray(res2.questions) && res2.questions.length > 0, 'Test 2 Failed: Should return questions.');
    console.log(res2.needsClarification === true ? '✓ Passed\n' : '✗ Failed\n');

    console.log('✅ ALL TESTS COMPLETE!');
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    server.close();
    pool.end();
    process.exit(0);
  }
}

runTests();
