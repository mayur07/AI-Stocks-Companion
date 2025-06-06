import { Component, Input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NewsSummary } from '../../services/news-summary.service';

@Component({
  selector: 'app-news-summary',
  templateUrl: './news-summary.component.html',
  styleUrls: ['./news-summary.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, DatePipe]
})
export class NewsSummaryComponent {
  @Input() summaries: NewsSummary[] = [];
  @Input() maxItems: number = 5;
  expandedItems: Set<number> = new Set();

  constructor(private datePipe: DatePipe) {}

  toggleExpand(index: number): void {
    if (this.expandedItems.has(index)) {
      this.expandedItems.delete(index);
    } else {
      this.expandedItems.add(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expandedItems.has(index);
  }

  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'MMM d, y, h:mm a') || '';
  }

  getSentimentColor(sentiment: string): string {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'danger';
      case 'neutral':
        return 'medium';
      default:
        return 'primary';
    }
  }

  getSentimentIcon(sentiment: string): string {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return 'trending-up-outline';
      case 'negative':
        return 'trending-down-outline';
      case 'neutral':
        return 'trending-up-outline';
      default:
        return 'help-outline';
    }
  }

  getRelevanceColor(relevance: number): string {
    if (relevance >= 0.7) return 'success';
    if (relevance >= 0.4) return 'warning';
    return 'medium';
  }

  openArticle(url: string): void {
    window.open(url, '_blank');
  }
} 