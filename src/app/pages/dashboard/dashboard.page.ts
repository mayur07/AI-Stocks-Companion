import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { StockMarketService, MarketOverview, NewsItem, ConsensusStock } from '../../services/stock-market.service';
import { RouterModule } from '@angular/router';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { catchError, forkJoin } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, DatePipe, RouterModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DashboardPage implements OnInit {
  marketStatus: 'open' | 'closed' = 'closed';
  loading = false;
  error: string | null = null;
  news: NewsItem[] = [];
  topStocks: ConsensusStock[] = [];
  marketNews: NewsItem[] = [];
  economicNews: NewsItem[] = [];
  sectorNews: NewsItem[] = [];

  constructor(private stockMarketService: StockMarketService) {}

  ngOnInit() {
    this.loadMarketStatus();
    this.loadNews();
    this.loadTopStocks();
  }

  loadMarketStatus() {
    this.loading = true;
    this.error = null;

    this.stockMarketService.getMarketOverview().subscribe({
      next: (data) => {
        this.marketStatus = data.marketStatus;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading market status:', error);
        this.error = 'Failed to load market status';
        this.loading = false;
      }
    });
  }

  loadNews() {
    this.loading = true;
    this.error = null;

    forkJoin({
      marketNews: this.stockMarketService.getMarketNews(),
      economicNews: this.stockMarketService.getEconomicNews(),
      sectorNews: this.stockMarketService.getSectorNews()
    }).subscribe({
      next: (data) => {
        this.marketNews = this.transformNewsResponse(data.marketNews);
        this.economicNews = data.economicNews;
        this.sectorNews = data.sectorNews;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading news:', error);
        this.error = 'Failed to load news';
        this.loading = false;
      }
    });
  }

  loadTopStocks() {
    this.stockMarketService.getTopConsensusStocks(5).subscribe({
      next: (stocks) => {
        this.topStocks = stocks;
      },
      error: (error) => {
        console.error('Error loading top stocks:', error);
      }
    });
  }

  private transformNewsResponse(response: any): NewsItem[] {
    if (!response || !response.results) return [];
    
    return response.results.map((item: any) => ({
      title: item.title,
      content: item.description,
      source: item.publisher.name,
      publishedAt: new Date(item.published_utc),
      url: item.article_url,
      sentiment: this.determineSentiment(item.title + ' ' + item.description),
      relatedStocks: item.tickers || []
    }));
  }

  private determineSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'up', 'rise', 'gain', 'positive', 'growth', 'bullish', 'surge', 'rally', 'increase', 'profit',
      'beat', 'exceed', 'outperform', 'strong', 'improve', 'recovery', 'opportunity', 'potential'
    ];
    
    const negativeWords = [
      'down', 'fall', 'loss', 'negative', 'decline', 'bearish', 'plunge', 'drop', 'decrease', 'loss',
      'miss', 'underperform', 'weak', 'worse', 'concern', 'risk', 'warning', 'caution', 'delay'
    ];
    
    const lowerText = text.toLowerCase();
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = lowerText.match(regex);
      if (matches) positiveCount += matches.length;
    });
    
    negativeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      const matches = lowerText.match(regex);
      if (matches) negativeCount += matches.length;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment) {
      case 'positive': return 'success';
      case 'negative': return 'danger';
      default: return 'medium';
    }
  }

  getStockImpact(stock: ConsensusStock): string {
    if (stock.consensus === 'positive' && stock.averageChange > 0) {
      return 'Likely to rise';
    } else if (stock.consensus === 'negative' && stock.averageChange < 0) {
      return 'Likely to fall';
    } else if (stock.consensus === 'positive' && stock.averageChange < 0) {
      return 'Potential recovery';
    } else if (stock.consensus === 'negative' && stock.averageChange > 0) {
      return 'Potential correction';
    }
    return 'Neutral';
  }
} 