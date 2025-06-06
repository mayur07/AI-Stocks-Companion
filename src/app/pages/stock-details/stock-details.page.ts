import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { StockMarketService, StockData, NewsItem, CompanyOverview } from '../../services/stock-market.service';

@Component({
  selector: 'app-stock-details',
  templateUrl: './stock-details.page.html',
  styleUrls: ['./stock-details.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, DatePipe],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class StockDetailsPage implements OnInit {
  symbol: string = '';
  stockData: StockData | null = null;
  companyOverview: CompanyOverview | null = null;
  newsItems: NewsItem[] = [];
  technicalIndicators: any = {};
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private stockMarketService: StockMarketService
  ) {}

  ngOnInit() {
    this.symbol = this.route.snapshot.paramMap.get('symbol') || '';
    if (this.symbol) {
      this.loadStockDetails();
    }
  }

  private loadStockDetails() {
    this.isLoading = true;
    
    // Load stock data
    this.stockMarketService.getStockData(this.symbol).subscribe({
      next: (data) => {
        this.stockData = data;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading stock data:', error);
        this.isLoading = false;
      }
    });

    // Load company overview
    this.stockMarketService.getCompanyOverview(this.symbol).subscribe({
      next: (data) => {
        this.companyOverview = data;
      },
      error: (error) => {
        console.error('Error loading company overview:', error);
      }
    });

    // Load news
    this.stockMarketService.getStockNews(this.symbol).subscribe({
      next: (data) => {
        this.newsItems = data;
      },
      error: (error) => {
        console.error('Error loading news:', error);
      }
    });

    // Load technical indicators
    this.stockMarketService.getTechnicalIndicators(this.symbol).subscribe({
      next: (data) => {
        this.technicalIndicators = data;
      },
      error: (error) => {
        console.error('Error loading technical indicators:', error);
      }
    });
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'danger';
      default:
        return 'medium';
    }
  }

  refreshData() {
    this.loadStockDetails();
  }
} 