import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { SentimentAnalysis, SentimentScore, Keyword, Entity, TrendPoint } from '../../models/sentiment.model';
import { Chart } from 'chart.js';

@Component({
  selector: 'app-sentiment-gauge',
  templateUrl: './sentiment-gauge.component.html',
  styleUrls: ['./sentiment-gauge.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class SentimentGaugeComponent implements OnInit, OnChanges {
  @Input() sentimentAnalysis!: SentimentAnalysis;
  gaugeValue: number = 0;
  gaugeColor: string = '#4CAF50';
  private chart!: Chart;

  ngOnInit() {
    this.initializeChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sentimentAnalysis']) {
      this.updateGauge();
      this.updateChart();
    }
  }

  private updateGauge() {
    if (this.sentimentAnalysis?.sentimentScore) {
      const score = this.sentimentAnalysis.sentimentScore.overall;
      this.gaugeValue = Math.round(score * 100);
      this.gaugeColor = this.getSentimentColor(score);
    }
  }

  private initializeChart() {
    const ctx = document.getElementById('sentimentTrendChart') as HTMLCanvasElement;
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Sentiment Score',
            data: [],
            borderColor: '#4CAF50',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 1
          }
        }
      }
    });
  }

  private updateChart() {
    if (this.sentimentAnalysis?.sentimentScore?.trend) {
      const trend = this.sentimentAnalysis.sentimentScore.trend;
      this.chart.data.labels = trend.map((t: TrendPoint) => new Date(t.timestamp).toLocaleDateString());
      this.chart.data.datasets[0].data = trend.map((t: TrendPoint) => t.score);
      this.chart.update();
    }
  }

  getSentimentLabel(): string {
    const score = this.sentimentAnalysis?.sentimentScore?.overall || 0;
    if (score >= 0.6) return 'Very Positive';
    if (score >= 0.4) return 'Positive';
    if (score >= 0.2) return 'Neutral';
    if (score >= 0) return 'Negative';
    return 'Very Negative';
  }

  getConfidenceLabel(): string {
    const confidence = this.sentimentAnalysis?.sentimentScore?.confidence || 0;
    if (confidence >= 0.8) return 'High Confidence';
    if (confidence >= 0.6) return 'Moderate Confidence';
    return 'Low Confidence';
  }

  getSentimentColor(score: number): string {
    if (score >= 0.6) return '#4CAF50';
    if (score >= 0.4) return '#8BC34A';
    if (score >= 0.2) return '#FFC107';
    if (score >= 0) return '#FF9800';
    return '#F44336';
  }

  getTopicKeywords(topic: string): Keyword[] {
    return this.sentimentAnalysis?.sentimentScore?.keywords
      .filter((k: Keyword) => k.topic === topic)
      .sort((a: Keyword, b: Keyword) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 5) || [];
  }

  getKeywordColor(keyword: Keyword): string {
    if (keyword.score > 0) return 'success';
    if (keyword.score < 0) return 'danger';
    return 'warning';
  }

  getEntityCategories(): string[] {
    const categories = new Set<string>();
    this.sentimentAnalysis?.sentimentScore?.entities
      .forEach((e: Entity) => categories.add(e.category));
    return Array.from(categories);
  }

  getEntitiesByCategory(category: string): Entity[] {
    return this.sentimentAnalysis?.sentimentScore?.entities
      .filter((e: Entity) => e.category === category)
      .sort((a: Entity, b: Entity) => b.relevance - a.relevance) || [];
  }

  getEntityColor(entity: Entity): string {
    switch (entity.category) {
      case 'company': return 'primary';
      case 'financial': return 'success';
      case 'market': return 'warning';
      case 'product': return 'tertiary';
      default: return 'medium';
    }
  }

  getTopKeywords(): Keyword[] {
    return this.sentimentAnalysis?.sentimentScore?.keywords
      .sort((a: Keyword, b: Keyword) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 10) || [];
  }

  getTopicColor(topic: string): string {
    const topicColors: { [key: string]: string } = {
      'market_performance': 'success',
      'financial_health': 'primary',
      'market_position': 'warning',
      'growth': 'tertiary',
      'risk': 'danger'
    };
    return topicColors[topic] || 'medium';
  }
} 