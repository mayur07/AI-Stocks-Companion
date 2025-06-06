import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { StockMarketService, StockData } from '../../services/stock-market.service';

@Component({
  selector: 'app-watchlist',
  templateUrl: './watchlist.page.html',
  styleUrls: ['./watchlist.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class WatchlistPage implements OnInit {
  watchlist: StockData[] = [];
  isLoading = true;

  constructor(private stockMarketService: StockMarketService) {}

  ngOnInit() {
    this.loadWatchlist();
  }

  private loadWatchlist() {
    this.isLoading = true;
    this.stockMarketService.getMarketOverview().subscribe({
      next: (data) => {
        this.watchlist = data.topGainers;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading watchlist:', error);
        this.isLoading = false;
      }
    });
  }

  removeFromWatchlist(symbol: string) {
    // TODO: Implement remove from watchlist functionality
    console.log('Remove from watchlist:', symbol);
  }

  refreshWatchlist() {
    this.loadWatchlist();
  }
} 