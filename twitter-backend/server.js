const express = require('express');
const cors = require('cors');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
// const port = process.env.PORT || 3000;
const port = 3000;

// Get Twitter Bearer Token (hardcoded)
const TWITTER_BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAOc72QEAAAAAhereL3g5x%2BBcEa8EkqxlkhYWshs%3DAsjGxmxcNwpmZiXW4kUqitL2sDAn4RzPOWEhIQ28iwwd5n8kRj'; // <-- Place your token here

if (!TWITTER_BEARER_TOKEN) {
  console.error('TWITTER_BEARER_TOKEN is not set. Please hardcode your token.');
  process.exit(1);
}

// Initialize Twitter client with read-only access
const client = new TwitterApi(TWITTER_BEARER_TOKEN);
const twitterClient = client.readOnly;

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:8100', 'http://localhost:4200', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Get recent tweets by topic
app.get('/api/twitter/topic/:topic', async (req, res) => {
  try {
    const { topic } = req.params;
    console.log(`Fetching recent tweets about: ${topic}`);

    // Check cache first
    const cacheKey = `topic:${topic}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log('Returning cached data for:', topic);
      return res.json(cachedData.data);
    }
    
    const tweets = await twitterClient.v2.search(topic, {
      'tweet.fields': ['created_at', 'public_metrics', 'author_id', 'text'],
      'user.fields': ['username', 'name', 'profile_image_url'],
      expansions: ['author_id'],
      max_results: 10
    });
    
    if (!tweets.data || !Array.isArray(tweets.data)) {
      return res.status(404).json({ error: 'No tweets found for this topic' });
    }

    // Transform the response to include user data with tweets
    const transformedTweets = tweets.data.map(tweet => {
      const user = tweets.includes?.users?.find(u => u.id === tweet.author_id);
      return {
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at,
        metrics: tweet.public_metrics || {
          retweet_count: 0,
          reply_count: 0,
          like_count: 0,
          quote_count: 0
        },
        author: user ? {
          id: user.id,
          username: user.username,
          name: user.name,
          profile_image_url: user.profile_image_url
        } : null
      };
    });

    // Cache the transformed data
    cache.set(cacheKey, {
      data: transformedTweets,
      timestamp: Date.now()
    });

    res.json(transformedTweets);
  } catch (error) {
    console.error('Error fetching tweets:', error);
    if (error.code === 429) {
      // If we hit rate limit, try to return cached data even if expired
      const cacheKey = `topic:${req.params.topic}`;
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        console.log('Rate limited, returning expired cache for:', req.params.topic);
        return res.json(cachedData.data);
      }
      
      res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a few minutes.',
        retryAfter: error.rateLimit?.reset
      });
    } else if (error.code === 401) {
      res.status(401).json({
        error: 'Twitter API authentication failed. Please check the bearer token.'
      });
    } else {
      res.status(500).json({ 
        error: error.message,
        code: error.code
      });
    }
  }
});

// Get user's recent tweets
app.get('/api/twitter/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    console.log(`Fetching tweets for user: ${username}`);
    
    const user = await twitterClient.v2.userByUsername(username);
    if (!user.data) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tweets = await twitterClient.v2.userTimeline(user.data.id, {
      'tweet.fields': ['created_at', 'public_metrics'],
      max_results: 10
    });

    res.json(tweets);
  } catch (error) {
    console.error('Error fetching user tweets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get tweet details
app.get('/api/twitter/tweet/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching tweet: ${id}`);
    
    const tweet = await twitterClient.v2.singleTweet(id, {
      'tweet.fields': ['created_at', 'public_metrics', 'author_id'],
      'user.fields': ['username', 'name', 'profile_image_url'],
      expansions: ['author_id']
    });

    if (!tweet.data) {
      return res.status(404).json({ error: 'Tweet not found' });
    }

    res.json(tweet);
  } catch (error) {
    console.error('Error fetching tweet:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Twitter API client initialized with Free API access');
  console.log('Available endpoints:');
  console.log('- GET /api/twitter/topic/:topic - Get recent tweets about a topic');
  console.log('- GET /api/twitter/user/:username - Get user\'s recent tweets');
  console.log('- GET /api/twitter/tweet/:id - Get tweet details');
}); 