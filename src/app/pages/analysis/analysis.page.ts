import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { StockMarketService, StockData, TechnicalIndicators, CompanyOverview } from '../../services/stock-market.service';
import { NewsSummaryService, NewsSummary } from '../../services/news-summary.service';
import { forkJoin, of, Observable, Subject, throwError } from 'rxjs';
import { catchError, map, switchMap, debounceTime, distinctUntilChanged, filter, tap } from 'rxjs/operators';
import { Chart, ChartConfiguration, ChartData, ChartTypeRegistry, registerables, Point } from 'chart.js';
import { ActivatedRoute } from '@angular/router';
import { NewsSummaryComponent } from '../../components/news-summary/news-summary.component';

interface HistoricalData {
  dates: string[];
  prices: number[];
  volumes: number[];
}

interface AnalysisData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  technicalIndicators: TechnicalIndicators;
  sentiment: {
    overallSentiment: 'positive' | 'negative' | 'neutral';
    newsSentiment: Array<{
      title: string;
      sentiment: 'positive' | 'negative' | 'neutral';
    }>;
  };
  dataQuality: number;
  lastUpdated: Date;
}

interface StockSuggestion {
  symbol: string;
  name: string;
  exchange: string;
}

interface AIAnalysis {
  pricePrediction: {
    predictedPrice: number;
    confidence: number;
    timeframe: string;
    factors: string[];
  };
  technicalInsights: {
    trendAnalysis: string;
    supportResistance: {
      support: number[];
      resistance: number[];
    };
    patternRecognition: string[];
  };
  riskAssessment: {
    riskLevel: 'low' | 'medium' | 'high';
    riskFactors: string[];
    volatility: number;
  };
  investmentRecommendation: {
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    reasoning: string[];
    targetPrice: number;
    stopLoss: number;
  };
}

@Component({
  selector: 'app-analysis',
  templateUrl: './analysis.page.html',
  styleUrls: ['./analysis.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    DatePipe,
    FormsModule,
    NewsSummaryComponent
  ]
})
export class AnalysisPage implements OnInit {
  symbol: string = '';
  stockData: StockData | null = null;
  technicalIndicators: TechnicalIndicators | null = null;
  companyOverview: CompanyOverview | null = null;
  loading = true;
  error: string | null = null;
  analysisData: AnalysisData | null = null;
  newsSummaries: NewsSummary[] = [];
  
  // Historical data
  historicalData: HistoricalData = {
    dates: [],
    prices: [],
    volumes: []
  };

  // Chart instances
  priceChart: Chart | null = null;
  volumeChart: Chart | null = null;
  technicalChart: Chart | null = null;

  // Time periods for comparison
  timePeriods = ['1D', '1W', '1M', '3M', '6M', '1Y', '5Y'];
  selectedPeriod = '1M';

  aiAnalysis: AIAnalysis | null = null;
  showAIAnalysis = false;

  constructor(
    private stockMarketService: StockMarketService,
    private newsSummaryService: NewsSummaryService,
    private route: ActivatedRoute
  ) {
    // Initialize Chart.js
    Chart.register(...registerables);
  }

  ngOnInit() {
    this.route.params.pipe(
      map(params => params['symbol']),
      switchMap(symbol => {
        if (symbol) {
          this.symbol = symbol;
          return this.loadAnalysisData(symbol);
        }
        return of(null);
      })
    ).subscribe({
      next: (data) => {
        if (data) {
          this.analysisData = data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading analysis:', error);
        this.error = 'Failed to load analysis data. Please try again.';
        this.loading = false;
      }
    });
  }

  analyzeStock() {
    if (!this.symbol) {
      this.error = 'Please enter a stock symbol';
      return;
    }

    console.log('Starting stock analysis for:', this.symbol);
    this.loading = true;
    this.error = null;

    // Use loadAnalysisData which now has optimized caching
    this.loadAnalysisData(this.symbol).subscribe({
      next: (data) => {
        console.log('Analysis data received in analyzeStock:', data);
        this.analysisData = data;
        this.stockData = {
          symbol: this.symbol,
          name: this.symbol,
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          volume: 0, // These will be updated if needed
          marketCap: 0,
          lastUpdated: new Date()
        };
        this.technicalIndicators = data.technicalIndicators;
        
        console.log('Updated component state:', {
          analysisData: this.analysisData,
          stockData: this.stockData,
          technicalIndicators: this.technicalIndicators,
          newsSummaries: this.newsSummaries
        });
        
        // Initialize charts after data is loaded
        this.initializeCharts();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error in analysis:', error);
        this.error = 'Failed to complete analysis. Please try again.';
        this.loading = false;
      }
    });
  }

  private loadAnalysisData(symbol: string) {
    console.log('Starting loadAnalysisData for symbol:', symbol);
    // Use a single data source (Polygon) as primary source
    return this.stockMarketService.getStockData(symbol).pipe(
      tap(stockData => {
        console.log('Received stock data from service:', stockData);
        if (!stockData) {
          console.error('No stock data received from service');
        }
      }),
      switchMap(stockData => {
        if (!stockData) {
          console.error('No stock data available for processing');
          return throwError(() => new Error('Failed to fetch stock data'));
        }

        console.log('Fetching additional data for:', symbol);
        // Only fetch additional data if needed
        return forkJoin({
          technical: this.stockMarketService.getTechnicalIndicators(symbol).pipe(
            tap(tech => console.log('Received technical indicators:', tech)),
            catchError(error => {
              console.error('Error fetching technical indicators:', error);
              return of({
                sma20: 0,
                ema20: 0,
                rsi: 0,
                macd: {
                  signal: 0,
                  histogram: 0
                }
              });
            })
          ),
          sentiment: this.stockMarketService.getSentimentAnalysis(symbol).pipe(
            tap(sent => console.log('Received sentiment analysis:', sent)),
            catchError(error => {
              console.error('Error fetching sentiment analysis:', error);
              return of({
                overallSentiment: 'neutral' as const,
                newsSentiment: []
              });
            })
          ),
          news: this.newsSummaryService.getNewsSummaries(symbol).pipe(
            tap(news => {
              console.log('Received news summaries:', news);
              if (!news || news.length === 0) {
                console.warn('No news summaries received for symbol:', symbol);
              }
            }),
            catchError(error => {
              console.error('Error fetching news summaries:', error);
              return of([]);
            })
          )
        }).pipe(
          tap(data => {
            console.log('All data received:', data);
            console.log('News data:', data.news);
          }),
          map(data => {
            console.log('Processing combined data:', data);
            // Update newsSummaries with the fetched news
            this.newsSummaries = data.news || [];
            console.log('Updated newsSummaries:', this.newsSummaries);

            // Enhance news sentiment with more detailed analysis
            const enhancedNewsSentiment = (data.news || []).map(news => ({
              title: news.title,
              sentiment: news.sentiment,
              relevance: news.relevance || 1 // Default relevance to 1 if not provided
            }));
            console.log('Enhanced news sentiment:', enhancedNewsSentiment);

            // Calculate overall sentiment based on news sentiment and relevance
            const overallSentiment = this.calculateOverallSentiment(enhancedNewsSentiment);
            console.log('Calculated overall sentiment:', overallSentiment);

            const analysisData = {
              symbol,
              price: stockData.price,
              change: stockData.change,
              changePercent: stockData.changePercent,
              technicalIndicators: data.technical,
              sentiment: {
                overallSentiment,
                newsSentiment: enhancedNewsSentiment
              },
              dataQuality: this.calculateDataQuality({ stockData, ...data }),
              lastUpdated: new Date()
            };

            console.log('Created analysis data:', analysisData);
            return analysisData;
          })
        );
      })
    );
  }

  private calculateDataQuality(data: any): number {
    let quality = 0;
    
    if (data.stockData) quality += 40;
    if (data.technical && data.technical.sma20 !== 0) quality += 20;
    if (data.company) quality += 20;
    if (data.sentiment && data.sentiment.overallSentiment) quality += 20;
    
    return quality;
  }

  initializeCharts() {
    if (!this.technicalIndicators) return;

    // Technical Indicators Chart
    const technicalCtx = document.getElementById('technicalChart') as HTMLCanvasElement;
    if (technicalCtx) {
      // Destroy existing chart if it exists
      if (this.technicalChart) {
        this.technicalChart.destroy();
      }

      const technicalConfig: ChartConfiguration = {
        type: 'line',
        data: {
          labels: ['SMA20', 'EMA20', 'RSI', 'MACD Signal', 'MACD Histogram'],
          datasets: [
            {
              label: 'Technical Indicators',
              data: [
                this.technicalIndicators.sma20,
                this.technicalIndicators.ema20,
                this.technicalIndicators.rsi,
                this.technicalIndicators.macd.signal,
                this.technicalIndicators.macd.histogram
              ],
              backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 159, 64, 0.2)'
              ],
              borderColor: [
                'rgb(255, 99, 132)',
                'rgb(54, 162, 235)',
                'rgb(75, 192, 192)',
                'rgb(153, 102, 255)',
                'rgb(255, 159, 64)'
              ],
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            title: {
              display: true,
              text: 'Technical Indicators'
            },
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      };
      this.technicalChart = new Chart(technicalCtx, technicalConfig);
    }
  }

  changeTimePeriod(period: string | number | undefined) {
    this.selectedPeriod = String(period || '1M');
    this.analyzeStock();
  }

  getAveragePrice(): number {
    if (!this.analysisData?.price) return 0;
    return this.analysisData.price;
  }

  getAverageChangePercent(): number {
    if (!this.analysisData?.changePercent) return 0;
    return this.analysisData.changePercent;
  }

  getConsensusSentiment(): 'positive' | 'negative' | 'neutral' {
    if (!this.analysisData?.sentiment.overallSentiment) return 'neutral';
    return this.analysisData.sentiment.overallSentiment;
  }

  getDataQuality(): number {
    if (!this.analysisData) return 0;
    return this.analysisData.dataQuality;
  }

  getDataQualityText(): string {
    const quality = this.getDataQuality();
    if (quality >= 80) return 'High Quality Analysis';
    if (quality >= 50) return 'Moderate Quality Analysis';
    return 'Limited Data Available';
  }

  getHistoricalComparison(): { change: number; period: string } {
    if (!this.historicalData.prices.length) return { change: 0, period: this.selectedPeriod };

    const currentPrice = this.historicalData.prices[this.historicalData.prices.length - 1];
    const previousPrice = this.historicalData.prices[0];
    const change = ((currentPrice - previousPrice) / previousPrice) * 100;

    return {
      change,
      period: this.selectedPeriod
    };
  }

  getBollingerBands() {
    if (!this.technicalIndicators) return null;
    
    const sma = this.technicalIndicators.sma20;
    const stdDev = 2; // Standard deviation multiplier
    
    return {
      upper: sma + (stdDev * sma * 0.02), // Approximate standard deviation
      middle: sma,
      lower: sma - (stdDev * sma * 0.02)
    };
  }

  getRSIClass(rsi: number): string {
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    return 'neutral';
  }

  getMACDClass(macd: { signal: number; histogram: number }): string {
    if (macd.histogram > 0) return 'positive';
    if (macd.histogram < 0) return 'negative';
    return 'neutral';
  }

  getSentimentClass(sentiment: 'positive' | 'negative' | 'neutral'): string {
    return sentiment;
  }

  getSentimentIcon(sentiment: 'positive' | 'negative' | 'neutral'): string {
    switch (sentiment) {
      case 'positive':
        return 'trending-up';
      case 'negative':
        return 'trending-down';
      default:
        return 'trending-flat';
    }
  }

  getPredictionClass(): string {
    if (!this.technicalIndicators || !this.analysisData) return 'neutral';

    const rsi = this.technicalIndicators.rsi;
    const macd = this.technicalIndicators.macd.histogram;
    const sentiment = this.analysisData.sentiment.overallSentiment;

    // Combine technical indicators and sentiment for prediction
    let bullishSignals = 0;
    let bearishSignals = 0;

    // RSI signals
    if (rsi < 30) bullishSignals++;
    if (rsi > 70) bearishSignals++;

    // MACD signals
    if (macd > 0) bullishSignals++;
    if (macd < 0) bearishSignals++;

    // Sentiment signals
    if (sentiment === 'positive') bullishSignals++;
    if (sentiment === 'negative') bearishSignals++;

    if (bullishSignals > bearishSignals) return 'positive';
    if (bearishSignals > bullishSignals) return 'negative';
    return 'neutral';
  }

  getPredictionIcon(): string {
    const predictionClass = this.getPredictionClass();
    switch (predictionClass) {
      case 'positive':
        return 'arrow-up';
      case 'negative':
        return 'arrow-down';
      default:
        return 'arrow-forward';
    }
  }

  getPricePrediction(): string {
    const predictionClass = this.getPredictionClass();
    switch (predictionClass) {
      case 'positive':
        return 'Likely to Rise';
      case 'negative':
        return 'Likely to Fall';
      default:
        return 'Neutral Outlook';
    }
  }

  getRSILabel(rsi: number): string {
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    return 'Neutral';
  }

  getMACDLabel(macd: { signal: number; histogram: number }): string {
    if (macd.histogram > 0) return 'Bullish Momentum';
    if (macd.histogram < 0) return 'Bearish Momentum';
    return 'Neutral Momentum';
  }

  refreshAnalysis() {
    if (!this.symbol) {
      this.error = 'Please enter a stock symbol';
      return;
    }

    this.loading = true;
    this.error = null;

    this.loadAnalysisData(this.symbol).subscribe({
      next: (data) => {
        this.analysisData = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error refreshing analysis:', error);
        this.error = 'Failed to refresh analysis data. Please try again.';
        this.loading = false;
      }
    });
  }

  private calculateOverallSentiment(newsSentiment: Array<{ sentiment: 'positive' | 'negative' | 'neutral', relevance: number }>): 'positive' | 'negative' | 'neutral' {
    console.log('Calculating overall sentiment from:', newsSentiment);
    if (!newsSentiment || newsSentiment.length === 0) {
      console.log('No news sentiment data available, returning neutral');
      return 'neutral';
    }

    let positiveScore = 0;
    let negativeScore = 0;
    let totalRelevance = 0;

    newsSentiment.forEach(item => {
      const weightedScore = item.relevance || 1; // Default to 1 if relevance is not provided
      totalRelevance += weightedScore;

      switch (item.sentiment) {
        case 'positive':
          positiveScore += weightedScore;
          break;
        case 'negative':
          negativeScore += weightedScore;
          break;
      }
    });

    console.log('Sentiment scores:', { positiveScore, negativeScore, totalRelevance });

    if (totalRelevance === 0) {
      console.log('No relevance scores, returning neutral');
      return 'neutral';
    }

    const positiveRatio = positiveScore / totalRelevance;
    const negativeRatio = negativeScore / totalRelevance;

    console.log('Sentiment ratios:', { positiveRatio, negativeRatio });

    if (positiveRatio > 0.6) return 'positive';
    if (negativeRatio > 0.6) return 'negative';
    return 'neutral';
  }

  getChangeClass(): string {
    if (!this.stockData?.changePercent) return 'neutral';
    return this.stockData.changePercent >= 0 ? 'positive' : 'negative';
  }

  getChangePrefix(): string {
    if (!this.stockData?.changePercent) return '';
    return this.stockData.changePercent >= 0 ? '+' : '';
  }

  getChangePercent(): number {
    return this.stockData?.changePercent || 0;
  }

  getOverallSentiment(): 'positive' | 'negative' | 'neutral' {
    return this.analysisData?.sentiment.overallSentiment || 'neutral';
  }

  // Add a method to safely check news summaries
  hasNewsSummaries(): boolean {
    return Array.isArray(this.newsSummaries) && this.newsSummaries.length > 0;
  }

  private generateAIAnalysis(data: AnalysisData): AIAnalysis {
    console.log('Generating AI analysis for:', data);
    
    // Price Prediction
    const pricePrediction = this.predictPrice(data);
    
    // Technical Insights
    const technicalInsights = this.analyzeTechnicalPatterns(data);
    
    // Risk Assessment
    const riskAssessment = this.assessRisk(data);
    
    // Investment Recommendation
    const investmentRecommendation = this.generateRecommendation(data, pricePrediction, riskAssessment);

    return {
      pricePrediction,
      technicalInsights,
      riskAssessment,
      investmentRecommendation
    };
  }

  private predictPrice(data: AnalysisData): AIAnalysis['pricePrediction'] {
    const { price, technicalIndicators, sentiment } = data;
    
    // Calculate price momentum
    const rsi = technicalIndicators.rsi;
    const macd = technicalIndicators.macd;
    const sentimentScore = sentiment.overallSentiment === 'positive' ? 1 : 
                          sentiment.overallSentiment === 'negative' ? -1 : 0;
    
    // Simple prediction model (can be enhanced with ML)
    const momentum = (rsi - 50) / 50; // Normalize RSI
    const macdSignal = macd.histogram > 0 ? 1 : -1;
    
    const predictedChange = (momentum + macdSignal + sentimentScore) / 3;
    const predictedPrice = price * (1 + predictedChange * 0.05); // 5% max change
    
    return {
      predictedPrice,
      confidence: Math.abs(predictedChange) * 100,
      timeframe: '1 month',
      factors: [
        `RSI indicates ${rsi > 50 ? 'bullish' : 'bearish'} momentum`,
        `MACD shows ${macd.histogram > 0 ? 'positive' : 'negative'} trend`,
        `Market sentiment is ${sentiment.overallSentiment}`
      ]
    };
  }

  private analyzeTechnicalPatterns(data: AnalysisData): AIAnalysis['technicalInsights'] {
    const { technicalIndicators } = data;
    const patterns: string[] = [];
    
    // RSI Analysis
    if (technicalIndicators.rsi > 70) {
      patterns.push('Overbought condition detected');
    } else if (technicalIndicators.rsi < 30) {
      patterns.push('Oversold condition detected');
    }
    
    // MACD Analysis
    if (technicalIndicators.macd.histogram > 0 && technicalIndicators.macd.signal > 0) {
      patterns.push('Strong bullish momentum');
    } else if (technicalIndicators.macd.histogram < 0 && technicalIndicators.macd.signal < 0) {
      patterns.push('Strong bearish momentum');
    }
    
    // Support and Resistance levels (simplified)
    const support = [data.price * 0.95, data.price * 0.90];
    const resistance = [data.price * 1.05, data.price * 1.10];
    
    return {
      trendAnalysis: this.determineTrend(technicalIndicators),
      supportResistance: { support, resistance },
      patternRecognition: patterns
    };
  }

  private determineTrend(indicators: TechnicalIndicators): string {
    const { sma20, ema20, rsi, macd } = indicators;
    
    let bullishSignals = 0;
    let bearishSignals = 0;
    
    if (sma20 > ema20) bullishSignals++;
    if (rsi > 50) bullishSignals++;
    if (macd.histogram > 0) bullishSignals++;
    
    if (sma20 < ema20) bearishSignals++;
    if (rsi < 50) bearishSignals++;
    if (macd.histogram < 0) bearishSignals++;
    
    if (bullishSignals > bearishSignals) return 'Bullish trend detected';
    if (bearishSignals > bullishSignals) return 'Bearish trend detected';
    return 'Neutral trend detected';
  }

  private assessRisk(data: AnalysisData): AIAnalysis['riskAssessment'] {
    const { technicalIndicators, sentiment } = data;
    
    // Calculate volatility based on RSI and MACD
    const volatility = Math.abs(technicalIndicators.rsi - 50) / 50;
    
    const riskFactors: string[] = [];
    
    // Add risk factors based on technical indicators
    if (technicalIndicators.rsi > 70 || technicalIndicators.rsi < 30) {
      riskFactors.push('Extreme RSI levels indicate potential reversal');
    }
    
    if (Math.abs(technicalIndicators.macd.histogram) > 2) {
      riskFactors.push('Strong MACD divergence suggests potential trend change');
    }
    
    // Add sentiment-based risk factors
    if (sentiment.overallSentiment === 'negative') {
      riskFactors.push('Negative market sentiment increases downside risk');
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (volatility > 0.7 || riskFactors.length > 2) {
      riskLevel = 'high';
    } else if (volatility < 0.3 && riskFactors.length === 0) {
      riskLevel = 'low';
    }
    
    return {
      riskLevel,
      riskFactors,
      volatility
    };
  }

  private generateRecommendation(
    data: AnalysisData,
    pricePrediction: AIAnalysis['pricePrediction'],
    riskAssessment: AIAnalysis['riskAssessment']
  ): AIAnalysis['investmentRecommendation'] {
    const { technicalIndicators, sentiment } = data;
    
    // Calculate recommendation score
    let score = 0;
    
    // Technical indicators contribution
    if (technicalIndicators.rsi > 50) score += 1;
    if (technicalIndicators.macd.histogram > 0) score += 1;
    
    // Sentiment contribution
    if (sentiment.overallSentiment === 'positive') score += 1;
    else if (sentiment.overallSentiment === 'negative') score -= 1;
    
    // Price prediction contribution
    if (pricePrediction.predictedPrice > data.price) score += 1;
    else if (pricePrediction.predictedPrice < data.price) score -= 1;
    
    // Risk adjustment
    if (riskAssessment.riskLevel === 'high') score -= 1;
    else if (riskAssessment.riskLevel === 'low') score += 1;
    
    // Determine action
    let action: 'buy' | 'sell' | 'hold';
    if (score >= 2) action = 'buy';
    else if (score <= -2) action = 'sell';
    else action = 'hold';
    
    const reasoning: string[] = [];
    if (action === 'buy') {
      reasoning.push('Strong technical indicators suggest upward momentum');
      reasoning.push('Positive market sentiment supports price appreciation');
    } else if (action === 'sell') {
      reasoning.push('Technical indicators show potential downward pressure');
      reasoning.push('Market sentiment suggests caution');
    } else {
      reasoning.push('Mixed signals suggest waiting for clearer direction');
      reasoning.push('Current risk level warrants a conservative approach');
    }
    
    return {
      action,
      confidence: Math.abs(score) * 25, // Convert to percentage
      reasoning,
      targetPrice: pricePrediction.predictedPrice,
      stopLoss: data.price * (action === 'buy' ? 0.95 : 1.05)
    };
  }

  toggleAIAnalysis() {
    this.showAIAnalysis = !this.showAIAnalysis;
    if (this.showAIAnalysis && this.analysisData && !this.aiAnalysis) {
      this.aiAnalysis = this.generateAIAnalysis(this.analysisData);
    }
  }
} 