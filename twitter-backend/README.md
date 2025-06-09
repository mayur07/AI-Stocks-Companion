# Twitter Backend Service

A Node.js backend service that provides Twitter API integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following content:
```
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
```

3. Start the server:
```bash
npm start
```

## Available Endpoints

- `GET /api/twitter/topic/:topic` - Get recent tweets about a topic
- `GET /api/twitter/user/:username` - Get user's recent tweets
- `GET /api/twitter/tweet/:id` - Get tweet details

## Environment Variables

- `PORT` - Server port (default: 3000)
- `TWITTER_BEARER_TOKEN` - Twitter API Bearer Token (required) 