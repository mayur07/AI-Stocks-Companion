export interface SentimentAnalysis {
  sentimentScore: SentimentScore;
  newsSentiment: NewsSentiment[];
}

export interface SentimentScore {
  overall: number;
  confidence: number;
  components: {
    positive: number;
    neutral: number;
    negative: number;
  };
  keywords: Keyword[];
  entities: Entity[];
  topics: string[];
  trend: TrendPoint[];
}

export interface Keyword {
  word: string;
  score: number;
  topic: string;
  category: string;
}

export interface Entity {
  word: string;
  category: string;
  relevance: number;
}

export interface TrendPoint {
  timestamp: string;
  score: number;
}

export interface NewsSentiment {
  title: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: {
    overall: number;
    topics: string[];
    keywords: Keyword[];
  };
} 