import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { StockMarketService, NewsItem } from '../../services/stock-market.service';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

type NewsSource = 'all' | 'market' | 'economic' | 'sector';

@Component({
  selector: 'app-news',
  templateUrl: './news.page.html',
  styleUrls: ['./news.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  providers: [DatePipe],
  imports: [CommonModule, FormsModule, IonicModule],
  standalone: true
})
export class NewsPage implements OnInit {
  newsItems: NewsItem[] = [];
  loading = true;
  error = false;
  selectedSource: NewsSource = 'all';

  constructor(
    private stockMarketService: StockMarketService,
    public datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.loadNews();
  }

  loadNews() {
    this.loading = true;
    this.error = false;

    forkJoin({
      marketNews: this.stockMarketService.getMarketNews(),
      economicNews: this.stockMarketService.getEconomicNews(),
      sectorNews: this.stockMarketService.getSectorNews()
    }).subscribe({
      next: (data) => {
        this.newsItems = [
          ...this.transformNewsResponse(data.marketNews),
          ...data.economicNews,
          ...data.sectorNews
        ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading news:', err);
        this.error = true;
        this.loading = false;
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
      'miss', 'underperform', 'weak', 'worse', 'concern', 'risk', 'warning', 'caution'
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

  filterBySource(event: CustomEvent) {
    const value = event.detail.value as NewsSource;
    if (value) {
      this.selectedSource = value;
    }
  }

  get filteredNews(): NewsItem[] {
    if (this.selectedSource === 'all') {
      return this.newsItems;
    }
    return this.newsItems.filter(item => {
      switch (this.selectedSource) {
        case 'market':
          return item.source.toLowerCase().includes('market') || 
                 item.source.toLowerCase().includes('financial');
        case 'economic':
          return item.source.toLowerCase().includes('economic') || 
                 item.source.toLowerCase().includes('economy');
        case 'sector':
          return item.relatedStocks.length > 0;
        default:
          return true;
      }
    });
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'danger';
      default:
        return 'medium';
    }
  }

  refresh() {
    this.loadNews();
  }
} 