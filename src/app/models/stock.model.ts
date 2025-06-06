export interface ScrapedStockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  peRatio?: number;
  dividendYield?: number;
  eps?: number;
  beta?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  avgVolume?: number;
  sector?: string;
  industry?: string;
  source: string;
  lastUpdated: Date;
}

export interface ScrapedNewsItem {
  title: string;
  content: string;
  url: string;
  publishedAt: Date;
  source: 'Yahoo Finance' | 'MarketWatch' | 'CNBC';
  sentiment?: 'positive' | 'negative' | 'neutral';
  relatedStocks?: string[];
} 