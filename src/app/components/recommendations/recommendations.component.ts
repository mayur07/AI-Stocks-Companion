import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RecommendationService, Recommendation } from '../../services/recommendation.service';
import { NewsSummary } from '../../services/news-summary.service';

@Component({
  selector: 'app-recommendations',
  templateUrl: './recommendations.component.html',
  styleUrls: ['./recommendations.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class RecommendationsComponent implements OnInit {
  recommendations: Recommendation[] = [];
  loading = true;
  error: string | null = null;

  constructor(private recommendationService: RecommendationService) {}

  ngOnInit() {
    this.loadRecommendations();
  }

  loadRecommendations() {
    this.loading = true;
    this.error = null;

    this.recommendationService.getPersonalizedRecommendations().subscribe({
      next: (recommendations) => {
        this.recommendations = recommendations;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading recommendations:', error);
        this.error = 'Failed to load recommendations. Please try again.';
        this.loading = false;
      }
    });
  }

  getRecommendationIcon(type: string): string {
    switch (type) {
      case 'news':
        return 'newspaper-outline';
      case 'stock':
        return 'trending-up-outline';
      case 'sector':
        return 'business-outline';
      default:
        return 'information-circle-outline';
    }
  }

  getRecommendationColor(type: string): string {
    switch (type) {
      case 'news':
        return 'primary';
      case 'stock':
        return 'success';
      case 'sector':
        return 'warning';
      default:
        return 'medium';
    }
  }

  formatRelevance(relevance: number): string {
    return `${(relevance * 100).toFixed(0)}%`;
  }

  openRecommendation(recommendation: Recommendation) {
    if (recommendation.type === 'news') {
      const newsData = recommendation.data as NewsSummary;
      if (newsData && newsData.url) {
        window.open(newsData.url, '_blank');
      }
    }
  }
} 