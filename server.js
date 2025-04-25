// server.js - Lazy Lord MLM Backend (Node.js + Express)

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// In-memory DB (for demo only)
const users = {};
const tokens = {};
const referrals = {};
const userProgress = {};

// Funnel bot configuration
const FUNNEL_STEPS = {
  start: {
    message: "Welcome, Lazy Lord. I am your digital servant.",
    nextStep: "step1",
    tokenCost: 0
  },
  step1: {
    message: "Step 1: Register your free domain at https://www.freenom.com. Try something like yourbotempire.ml",
    nextStep: "step2",
    tokenCost: 50,
    action: "domain_registration"
  },
  step2: {
    message: "Step 2: Deploy your empire homepage in 1-click via Vercel: https://vercel.com/new. Use the GitHub template provided after signup.",
    nextStep: "step3",
    tokenCost: 100,
    action: "site_deployment"
  },
  step3: {
    message: "Step 3: Share your bot and referral link:\nBot: https://lazybot.flowiseai.com/chat?ref={{refCode}}\nReferral: https://gptempire.ml?ref={{refCode}}",
    nextStep: "step4",
    tokenCost: 50,
    action: "share_links"
  },
  step4: {
    message: "Step 4: Want bonus tokens? Tweet this:\n'This AI made this tweet and earns for me. Want one? https://gptempire.ml?ref={{refCode}}'",
    nextStep: "step5",
    tokenCost: 50,
    action: "social_share",
    reward: 200
  },
  step5: {
    message: "Step 5: Running low on tokens? Fuel your empire here: https://yourcheckoutlink.com/tokens?ref={{refCode}}",
    tokenCost: 50,
    action: "token_purchase"
  }
};

// Register a user (with optional referrer)
app.post('/register', (req, res) => {
  const { userId, referrerId, email } = req.body;
  
  if (!userId || !email) {
    return res.status(400).send({ success: false, message: 'Missing required fields' });
  }

  // Generate unique referral code
  const refCode = crypto.randomBytes(4).toString('hex');
  
  users[userId] = { 
    referrerId, 
    earned: 0,
    email,
    refCode,
    createdAt: new Date()
  };
  
  tokens[userId] = 1000; // default starting tokens
  userProgress[userId] = { currentStep: 'start', completedSteps: [] };
  
  if (referrerId) {
    referrals[referrerId] = [...(referrals[referrerId] || []), userId];
    // Bonus tokens for referrer
    tokens[referrerId] = (tokens[referrerId] || 0) + 100;
  }

  res.send({ 
    success: true,
    refCode,
    tokens: tokens[userId],
    nextStep: FUNNEL_STEPS.start
  });
});

// Get next funnel step
app.post('/bot/next-step', (req, res) => {
  const { userId, currentStep } = req.body;
  
  if (!users[userId]) {
    return res.status(404).send({ success: false, message: 'User not found' });
  }

  const step = FUNNEL_STEPS[currentStep];
  if (!step) {
    return res.status(400).send({ success: false, message: 'Invalid step' });
  }

  // Check if user has enough tokens
  if (tokens[userId] < step.tokenCost) {
    return res.status(400).send({ 
      success: false, 
      message: 'Not enough tokens',
      needsTokens: true
    });
  }

  // Deduct tokens for step
  tokens[userId] -= step.tokenCost;

  // Update user progress
  userProgress[userId].currentStep = step.nextStep;
  userProgress[userId].completedSteps.push(currentStep);

  // Handle step-specific actions and rewards
  if (step.action === 'social_share' && step.reward) {
    tokens[userId] += step.reward;
  }

  // Replace placeholders in message
  const message = step.message.replace('{{refCode}}', users[userId].refCode);

  res.send({
    success: true,
    message,
    nextStep: step.nextStep ? FUNNEL_STEPS[step.nextStep] : null,
    tokens: tokens[userId],
    progress: userProgress[userId]
  });
});

// Use tokens
app.post('/use-token', (req, res) => {
  const { userId, amount } = req.body;
  if (!tokens[userId] || tokens[userId] < amount) {
    return res.status(400).send({ success: false, message: 'Not enough tokens' });
  }
  tokens[userId] -= amount;
  res.send({ success: true, remaining: tokens[userId] });
});

// Webhook from LemonSqueezy
app.post('/webhook', (req, res) => {
  const { userId, productId, event } = req.body;
  
  // Verify webhook signature
  const signature = req.headers['x-signature'];
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).send({ success: false, message: 'Invalid signature' });
  }

  const tokenPacks = {
    'prod_1000': 1000,
    'prod_10000': 10000,
    'prod_100000': 100000,
  };

  if (tokenPacks[productId]) {
    tokens[userId] = (tokens[userId] || 0) + tokenPacks[productId];
    return res.send({ success: true });
  }

  if (productId === 'prod_subscription') {
    // handle referral rewards
    const referrer = users[userId]?.referrerId;
    if (referrer) {
      users[referrer].earned += 30;
      const superRef = users[referrer]?.referrerId;
      if (superRef) users[superRef].earned += 30;
    }
    return res.send({ success: true });
  }

  res.status(400).send({ success: false });
});

// Get user status
app.get('/user/:id', (req, res) => {
  const id = req.params.id;
  if (!users[id]) {
    return res.status(404).send({ success: false, message: 'User not found' });
  }

  res.send({
    success: true,
    data: {
      tokens: tokens[id] || 0,
      earned: users[id]?.earned || 0,
      recruits: referrals[id]?.length || 0,
      refCode: users[id].refCode,
      progress: userProgress[id],
      completedSteps: userProgress[id]?.completedSteps || []
    }
  });
});

// Helper function to verify webhook signatures
function verifyWebhookSignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.LEMONSQUEEZY_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
