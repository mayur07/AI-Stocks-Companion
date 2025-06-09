const express = require('express');
const cors = require('cors');
const { TwitterApi } = require('twitter-api-v2');
require('dotenv').config();

const app = express();
app.use(cors());

// Twitter client initialization
const client = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);

// Stream endpoint
app.get('/api/twitter/stream', async (req, res) => {
  try {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get stream rules
    const rules = await client.v2.streamRules();
    if (rules.data?.length) {
      await client.v2.updateStreamRules({
        delete: { ids: rules.data.map(rule => rule.id) }
      });
    }

    // Add default rules
    await client.v2.updateStreamRules({
      add: [
        { value: '(stock market OR stocks) -is:retweet lang:en', tag: 'stock_market' },
        { value: '(crypto OR cryptocurrency) -is:retweet lang:en', tag: 'crypto' },
        { value: '(trading OR trader) -is:retweet lang:en', tag: 'trading' },
        { value: '(investing OR investment) -is:retweet lang:en', tag: 'investing' }
      ]
    });

    // Start stream
    const stream = await client.v2.searchStream({
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      'user.fields': ['name', 'username', 'verified'],
      'expansions': ['author_id']
    });

    // Handle stream data
    for await (const { data, includes } of stream) {
      const tweet = {
        id: data.id,
        text: data.text,
        author: includes.users.find(u => u.id === data.author_id),
        metrics: data.public_metrics,
        timestamp: new Date(data.created_at)
      };
      res.write(`data: ${JSON.stringify(tweet)}\n\n`);
    }
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search endpoint
app.get('/api/twitter/search', async (req, res) => {
  try {
    const { query } = req.query;
    const tweets = await client.v2.search(query, {
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      'user.fields': ['name', 'username', 'verified'],
      'expansions': ['author_id'],
      'max_results': 100
    });
    res.json(tweets);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 