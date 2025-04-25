// server.js - Lazy Lord MLM Backend (Node.js + Express)

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory DB (for demo only)
const users = {};
const tokens = {};
const referrals = {};

// Register a user (with optional referrer)
app.post('/register', (req, res) => {
  const { userId, referrerId } = req.body;
  users[userId] = { referrerId, earned: 0 };
  tokens[userId] = 1000; // default starting tokens
  if (referrerId) {
    referrals[referrerId] = [...(referrals[referrerId] || []), userId];
  }
  res.send({ success: true });
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
  const { userId, productId } = req.body;
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
  res.send({
    tokens: tokens[id] || 0,
    earned: users[id]?.earned || 0,
    recruits: referrals[id]?.length || 0,
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
