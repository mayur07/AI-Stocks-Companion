import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { NewsSummary } from './news-summary.service';
import { StockData } from './stock-market.service';

export interface UserPreference {
  interests: string[];
  followedStocks: string[];
  preferredSectors: string[];
  readingHistory: {
    articleId: string;
    timestamp: number;
    timeSpent: number;
  }[];
  sentimentPreferences: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface Recommendation {
  type: 'news' | 'stock' | 'sector';
  title: string;
  description: string;
  relevance: number;
  data: NewsSummary | StockData | string;
  reason: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private userPreferences = new BehaviorSubject<UserPreference>({
    interests: [],
    followedStocks: [],
    preferredSectors: [],
    readingHistory: [],
    sentimentPreferences: {
      positive: 0.33,
      negative: 0.33,
      neutral: 0.34
    }
  });

  constructor(private http: HttpClient) {
    this.loadUserPreferences();
  }

  private loadUserPreferences() {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      this.userPreferences.next(JSON.parse(savedPreferences));
    }
  }

  private saveUserPreferences(preferences: UserPreference) {
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
    this.userPreferences.next(preferences);
  }

  updateUserPreferences(preferences: Partial<UserPreference>) {
    const currentPreferences = this.userPreferences.value;
    const updatedPreferences = { ...currentPreferences, ...preferences };
    this.saveUserPreferences(updatedPreferences);
  }

  trackArticleInteraction(articleId: string, timeSpent: number) {
    const currentPreferences = this.userPreferences.value;
    const readingHistory = [
      {
        articleId,
        timestamp: Date.now(),
        timeSpent
      },
      ...currentPreferences.readingHistory.slice(0, 49) // Keep last 50 interactions
    ];

    this.updateUserPreferences({ readingHistory });
  }

  getPersonalizedRecommendations(): Observable<Recommendation[]> {
    return this.userPreferences.pipe(
      switchMap(preferences => {
        return this.http.get<any[]>(`${environment.apiUrl}/recommendations`).pipe(
          map(recommendations => this.processRecommendations(recommendations, preferences)),
          catchError(() => of([]))
        );
      })
    );
  }

  private processRecommendations(recommendations: any[], preferences: UserPreference): Recommendation[] {
    return recommendations.map(rec => ({
      ...rec,
      relevance: this.calculateRelevance(rec, preferences)
    })).sort((a, b) => b.relevance - a.relevance);
  }

  private calculateRelevance(recommendation: any, preferences: UserPreference): number {
    let relevance = 0;

    // Content-based relevance
    if (recommendation.type === 'news') {
      // Check if the news matches user interests
      preferences.interests.forEach(interest => {
        if (recommendation.title.toLowerCase().includes(interest.toLowerCase())) {
          relevance += 0.2;
        }
      });

      // Check if the news is about followed stocks
      preferences.followedStocks.forEach(stock => {
        if (recommendation.title.toLowerCase().includes(stock.toLowerCase())) {
          relevance += 0.3;
        }
      });

      // Check if the news is from preferred sectors
      preferences.preferredSectors.forEach(sector => {
        if (recommendation.description.toLowerCase().includes(sector.toLowerCase())) {
          relevance += 0.2;
        }
      });
    }

    // Collaborative filtering relevance
    if (recommendation.type === 'stock') {
      // Check if similar users have shown interest
      const similarUserInterest = this.calculateSimilarUserInterest(recommendation);
      relevance += similarUserInterest * 0.3;
    }

    // Time-based relevance
    const recency = this.calculateRecency(recommendation);
    relevance += recency * 0.2;

    return Math.min(relevance, 1);
  }

  private calculateSimilarUserInterest(recommendation: any): number {
    // This would typically involve more complex collaborative filtering
    // For now, we'll use a simple implementation
    return Math.random() * 0.5 + 0.5;
  }

  private calculateRecency(recommendation: any): number {
    const now = Date.now();
    const age = now - new Date(recommendation.timestamp).getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - (daysOld / 30)); // Decay over 30 days
  }

  getRecommendedStocks(): Observable<StockData[]> {
    return this.getPersonalizedRecommendations().pipe(
      map(recommendations => 
        recommendations
          .filter(rec => rec.type === 'stock')
          .map(rec => rec.data as StockData)
      )
    );
  }

  getRecommendedNews(): Observable<NewsSummary[]> {
    return this.getPersonalizedRecommendations().pipe(
      map(recommendations => 
        recommendations
          .filter(rec => rec.type === 'news')
          .map(rec => rec.data as NewsSummary)
      )
    );
  }
} 