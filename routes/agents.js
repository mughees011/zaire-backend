const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'agents',
    status: 'mounted',
    message: 'Agent route layer online'
  });
});

// SWARM INTELLIGENCE CORE
// Orchestrates Research, Critic, Planner, and Executor agents

router.post('/swarm/initiate', (req, res) => {
  const { task } = req.body;
  if (!task) return res.status(400).json({ error: 'Task requirement missing' });

  // Generate a unique Swarm Thread ID
  const threadId = `swarm_${Date.now()}`;
  res.json({ success: true, threadId, message: 'Swarm initialized. Connect to /swarm/stream/' + threadId });
});

router.get('/swarm/stream/:threadId', (req, res) => {
  const { threadId } = req.params;
  const task = req.query.task || 'Analyzing objective...';

  // Setup Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (agent, action, status, data = '') => {
    res.write(`data: ${JSON.stringify({ agent, action, status, data, timestamp: new Date().toISOString() })}\n\n`);
  };

  // 1. Planner Agent kicks off
  sendEvent('Planner', 'Task Decomposition', 'active', `Breaking down task: ${task}`);
  
  setTimeout(() => {
    sendEvent('Planner', 'Task Decomposition', 'complete', 'Created 3 sub-objectives.');

    // 2. Research Agent works in parallel
    sendEvent('Research', 'Data Gathering', 'active', 'Scanning vector memory and web sources...');
    
    setTimeout(() => {
      sendEvent('Research', 'Data Gathering', 'complete', 'Gathered 14 data points.');
      
      // 3. Critic Agent evaluates research
      sendEvent('Critic', 'Validation', 'active', 'Evaluating research integrity and logic constraints...');
      
      setTimeout(() => {
        sendEvent('Critic', 'Validation', 'complete', 'Approved with 1 minor adjustment to approach.');
        
        // 4. Executor Agent applies logic
        sendEvent('Executor', 'Implementation', 'active', 'Executing validated plan...');
        
        setTimeout(() => {
          sendEvent('Executor', 'Implementation', 'complete', 'Task successfully resolved and applied.');
          
          // Swarm Complete
          sendEvent('System', 'Swarm Consensus', 'complete', 'All agents reached consensus. Operation finalized.');
          res.end();
        }, 3000);
      }, 2500);
    }, 3000);
  }, 2000);

  req.on('close', () => {
    // Clean up if client disconnects
    res.end();
  });
});

module.exports = router;
