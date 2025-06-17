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
import { TwelveDataService } from '@app/services/twelve-data.service';

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
  technicalIndicators: {
    rsi: number;
    macd: {
      signal: number;
      histogram: number;
    };
    sma20: number;
    ema20: number;
  };
  sentiment: {
    overallSentiment: 'positive' | 'negative' | 'neutral';
    newsSentiment: NewsSummary[];
  };
  dataQuality: DataQuality;
  lastUpdated: Date;
  source: 'twelveData' | 'marketData' | 'combined';
}

interface StockSuggestion {
  symbol: string;
  name: string;
  exchange: string;
}

interface AIAnalysis {
  prediction: string;
  confidenceScore: number;
  timestamp: Date;
  factors: string[];
  pricePredictions: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
  };
  technicalInsights: string[];
  riskAssessment: string[];
  recommendations: string[];
}

interface QuoteData {
  price: number;
  change: number;
  percent_change: number;
}

interface TechnicalData {
  sma20: number;
  ema20: number;
  rsi: number;
  macd: {
    signal: number;
    histogram: number;
  };
}

interface CombinedData {
  quote: {
    price: number;
    change: number;
    percent_change: number;
  };
  technical: {
    rsi: number;
    macd: {
      signal: number;
      histogram: number;
    };
    sma20: number;
    ema20: number;
  };
  news: NewsSummary[];
  fundamental?: any;
}

// Add adapter interfaces for type conversion
interface TwelveDataQuote {
  price: number;
  change: number;
  percent_change: number;
}

interface MarketDataQuote {
  price: number;
  change: number;
  changePercent: number;
}

interface CacheData {
  data: AnalysisData;
  timestamp: number;
  source: 'twelveData' | 'marketData';
}

interface DataQuality {
  completeness: number;
  reliability: number;
  freshness: number;
  confidence: number;
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

  realTimeData$: Observable<any>;
  advancedIndicators: any;
  timeSeriesData: any;

  twelveDataAnalysis: AnalysisData | null = null;
  marketDataAnalysis: AnalysisData | null = null;

  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly CACHE_PREFIX = 'stock_analysis_';

  constructor(
    private stockMarketService: StockMarketService,
    private newsSummaryService: NewsSummaryService,
    private route: ActivatedRoute,
    private twelveDataService: TwelveDataService
  ) {
    // Initialize Chart.js
    Chart.register(...registerables);

    // Initialize real-time data with empty symbol
    this.realTimeData$ = of(null);
  }

  ngOnInit() {
    console.log('Analysis page initialized');
    this.route.params.pipe(
      map(params => params['symbol']),
      tap(symbol => {
        console.log('Route params symbol:', symbol);
        if (symbol) {
          this.symbol = symbol;
          this.loading = true;
          this.error = null;
        }
      }),
      switchMap(symbol => {
        if (symbol) {
          return this.analyzeStock(symbol);
        }
        return of(null);
      })
    ).subscribe({
      next: (data) => {
        console.log('Analysis data received:', data);
        if (data) {
          this.twelveDataAnalysis = data.twelveDataAnalysis;
          this.marketDataAnalysis = data.marketDataAnalysis;
          this.analysisData = data.combinedAnalysis;
          this.aiAnalysis = this.generateAIAnalysis(data.combinedAnalysis);
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

  onSymbolInput(event: any) {
    const symbol = event.detail.value?.toUpperCase();
    console.log('Symbol input:', symbol);
    if (symbol && symbol.length > 0) {
      this.symbol = symbol;
      this.loading = true;
      this.error = null;
      
      this.analyzeStock(symbol).subscribe({
        next: (data) => {
          console.log('Analysis data received from input:', data);
          if (data) {
            this.twelveDataAnalysis = data.twelveDataAnalysis;
            this.marketDataAnalysis = data.marketDataAnalysis;
            this.analysisData = data.combinedAnalysis;
            this.aiAnalysis = this.generateAIAnalysis(data.combinedAnalysis);
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error in symbol input analysis:', error);
          this.error = 'Failed to analyze stock. Please try again.';
          this.loading = false;
        }
      });
    }
  }

  private analyzeStock(symbol: string): Observable<{
    twelveDataAnalysis: AnalysisData | null;
    marketDataAnalysis: AnalysisData | null;
    combinedAnalysis: AnalysisData;
  } | null> {
    console.log('Starting stock analysis for symbol:', symbol);
    
    return forkJoin({
      twelveData: this.getTwelveDataAnalysis(symbol).pipe(
        tap(data => console.log('TwelveData analysis result:', data)),
        catchError(error => {
          console.error('Error in TwelveData analysis:', error);
          return of(null);
        })
      ),
      marketData: this.getMarketDataAnalysis(symbol).pipe(
        tap(data => console.log('Market data analysis result:', data)),
        catchError(error => {
          console.error('Error in Market data analysis:', error);
          return of(null);
        })
      )
    }).pipe(
      map(results => {
        console.log('Combined analysis results:', results);
        if (!results.twelveData && !results.marketData) {
          throw new Error('No data available from either source');
        }
        
        const combinedAnalysis = this.combineAnalysisData(results.twelveData, results.marketData);
        console.log('Final combined analysis:', combinedAnalysis);
        
        return {
          twelveDataAnalysis: results.twelveData,
          marketDataAnalysis: results.marketData,
          combinedAnalysis
        };
      }),
      catchError(error => {
        console.error('Error combining analysis data:', error);
        this.error = 'Failed to analyze stock data. Please try again.';
        return of(null);
      })
    );
  }

  private getCacheKey(symbol: string, source: 'twelveData' | 'marketData'): string {
    return `${this.CACHE_PREFIX}${symbol}_${source}`;
  }

  private getCachedData(symbol: string, source: 'twelveData' | 'marketData'): AnalysisData | null {
    const cacheKey = this.getCacheKey(symbol, source);
    const cachedData = localStorage.getItem(cacheKey);
    
    if (!cachedData) return null;

    try {
      const { data, timestamp }: CacheData = JSON.parse(cachedData);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < this.CACHE_DURATION) {
        console.log(`Using cached ${source} data for ${symbol}`);
        return data;
      } else {
        // Cache expired, remove it
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('Error parsing cached data:', error);
      localStorage.removeItem(cacheKey);
      return null;
    }
  }

  private setCachedData(symbol: string, source: 'twelveData' | 'marketData', data: AnalysisData): void {
    const cacheKey = this.getCacheKey(symbol, source);
    const cacheData: CacheData = {
      data,
      timestamp: Date.now(),
      source
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      console.log(`Cached ${source} data for ${symbol}`);
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  private getTwelveDataAnalysis(symbol: string): Observable<AnalysisData | null> {
    // Try to get cached data first
    const cachedData = this.getCachedData(symbol, 'twelveData');
    if (cachedData) {
      return of(cachedData);
    }

    return this.twelveDataService.getRealTimeQuotes([symbol]).pipe(
      tap(quoteData => console.log('Received TwelveData real-time quote:', quoteData)),
      switchMap((quoteData: any) => {
        if (!quoteData) {
          throw new Error('No quote data available');
        }

        // Handle both array and single object responses
        const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;
        if (!quote) {
          throw new Error('Invalid quote data format');
        }

        return forkJoin({
          technical: this.twelveDataService.getTechnicalIndicators(symbol),
          news: this.newsSummaryService.getNewsSummaries(symbol)
        }).pipe(
          map(({ technical, news }) => ({
            quote,
            technical,
            news
          }))
        );
      }),
      switchMap((data: CombinedData) => {
        return this.twelveDataService.getFundamentalData(symbol).pipe(
          tap(fundData => console.log('Received TwelveData fundamental data:', fundData)),
          map(fundData => ({
            ...data,
            fundamental: fundData
          }))
        );
      }),
      map((data: CombinedData) => {
        const analysisData: AnalysisData = {
          symbol,
          price: Number(data.quote.price) || 0,
          change: Number(data.quote.change) || 0,
          changePercent: Number(data.quote.percent_change) || 0,
          technicalIndicators: {
            rsi: Number(data.technical?.rsi) || 0,
            macd: {
              signal: Number(data.technical?.macd?.signal) || 0,
              histogram: Number(data.technical?.macd?.histogram) || 0
            },
            sma20: Number(data.technical?.sma20) || 0,
            ema20: Number(data.technical?.ema20) || 0
          },
          sentiment: {
            overallSentiment: this.calculateSentiment(data.technical),
            newsSentiment: data.news || []
          },
          dataQuality: {
            completeness: 0,
            reliability: 0,
            freshness: 0,
            confidence: 0
          },
          lastUpdated: new Date(),
          source: 'twelveData'
        };

        // Calculate data quality
        analysisData.dataQuality = this.calculateDataQuality(analysisData);

        // Cache the data
        this.setCachedData(symbol, 'twelveData', analysisData);
        return analysisData;
      }),
      catchError(error => {
        console.error('Error in TwelveData analysis:', error);
        // Try to get cached data on error
        const cachedData = this.getCachedData(symbol, 'twelveData');
        if (cachedData) {
          console.log('Using cached TwelveData after error');
          return of(cachedData);
        }
        return of(null);
      })
    );
  }

  private getMarketDataAnalysis(symbol: string): Observable<AnalysisData | null> {
    // Try to get cached data first
    const cachedData = this.getCachedData(symbol, 'marketData');
    if (cachedData) {
      return of(cachedData);
    }

    return forkJoin({
      stockData: this.stockMarketService.getStockData(symbol),
      technicalIndicators: this.stockMarketService.getTechnicalIndicators(symbol),
      companyOverview: this.stockMarketService.getCompanyOverview(symbol),
      sentiment: this.stockMarketService.getSentimentAnalysis(symbol),
      news: this.newsSummaryService.getNewsSummaries(symbol)
    }).pipe(
      map(({ stockData, technicalIndicators, companyOverview, sentiment, news }) => {
        const analysisData: AnalysisData = {
          symbol,
          price: stockData.price || 0,
          change: stockData.change || 0,
          changePercent: stockData.changePercent || 0,
          technicalIndicators: {
            rsi: technicalIndicators.rsi || 0,
            macd: {
              signal: technicalIndicators.macd?.signal || 0,
              histogram: technicalIndicators.macd?.histogram || 0
            },
            sma20: technicalIndicators.sma20 || 0,
            ema20: technicalIndicators.ema20 || 0
          },
          sentiment: {
            overallSentiment: sentiment.overallSentiment || 'neutral',
            newsSentiment: news || []
          },
          dataQuality: {
            completeness: 0,
            reliability: 0,
            freshness: 0,
            confidence: 0
          },
          lastUpdated: new Date(),
          source: 'marketData'
        };

        // Calculate data quality
        analysisData.dataQuality = this.calculateDataQuality(analysisData);

        // Cache the data
        this.setCachedData(symbol, 'marketData', analysisData);
        return analysisData;
      }),
      catchError(error => {
        console.error('Error in market data analysis:', error);
        // Try to get cached data on error
        const cachedData = this.getCachedData(symbol, 'marketData');
        if (cachedData) {
          console.log('Using cached market data after error');
          return of(cachedData);
        }
        return of(null);
      })
    );
  }

  private calculateSentiment(technical: any): 'positive' | 'negative' | 'neutral' {
    if (!technical) return 'neutral';

    const rsi = technical.rsi || 0;
    const macd = technical.macd || { signal: 0, histogram: 0 };

    let score = 0;

    // RSI analysis
    if (rsi > 70) score -= 2; // Overbought
    else if (rsi < 30) score += 2; // Oversold
    else if (rsi > 50) score += 1; // Bullish
    else if (rsi < 50) score -= 1; // Bearish

    // MACD analysis
    if (macd.histogram > 0 && macd.signal > 0) score += 2; // Bullish
    else if (macd.histogram < 0 && macd.signal < 0) score -= 2; // Bearish

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  private calculateDataQuality(analysisData: AnalysisData): DataQuality {
    const quality: DataQuality = {
      completeness: 0,
      reliability: 0,
      freshness: 0,
      confidence: 0
    };

    // Calculate completeness
    const requiredFields = [
      analysisData.price,
      analysisData.change,
      analysisData.changePercent,
      analysisData.technicalIndicators.rsi,
      analysisData.technicalIndicators.macd.signal,
      analysisData.technicalIndicators.macd.histogram,
      analysisData.technicalIndicators.sma20,
      analysisData.technicalIndicators.ema20
    ];

    const presentFields = requiredFields.filter(field => field !== undefined && field !== null).length;
    quality.completeness = (presentFields / requiredFields.length) * 100;

    // Calculate reliability based on data consistency
    const priceConsistency = Math.abs(analysisData.changePercent) < 50; // Check for extreme price changes
    const indicatorConsistency = 
      analysisData.technicalIndicators.rsi >= 0 && 
      analysisData.technicalIndicators.rsi <= 100;

    quality.reliability = (priceConsistency && indicatorConsistency) ? 80 : 40;

    // Calculate freshness (assuming data is fresh if we're getting it)
    quality.freshness = 100;

    // Calculate overall confidence
    quality.confidence = (quality.completeness + quality.reliability + quality.freshness) / 3;

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
    if (this.symbol) {
      this.analyzeStock(this.symbol);
    }
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

  getDataQuality(): DataQuality {
    if (!this.analysisData) {
      return {
        completeness: 0,
        reliability: 0,
        freshness: 0,
        confidence: 0
      };
    }
    return this.analysisData.dataQuality;
  }

  getDataQualityText(): string {
    const quality = this.getDataQuality();
    if (quality.confidence >= 80) return 'High Quality Analysis';
    if (quality.confidence >= 50) return 'Moderate Quality Analysis';
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

    this.analyzeStock(this.symbol).subscribe({
      next: (data) => {
        if (data) {
          this.analysisData = data.combinedAnalysis;
        }
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
    const technicalScore = this.calculateTechnicalScore(data);
    const sentimentScore = this.calculateSentimentScore(data);
    const momentumScore = this.calculateMomentumScore(data);
    const volatilityScore = this.calculateVolatilityScore(data);
    const trendScore = this.calculateTrendScore(data);

    // Calculate overall confidence score
    const confidenceScore = Math.round(
      (technicalScore + sentimentScore + momentumScore + volatilityScore + trendScore) / 5
    );

    // Generate prediction based on scores
    const prediction = this.generatePrediction(data, {
      technicalScore,
      sentimentScore,
      momentumScore,
      volatilityScore,
      trendScore
    });

    // Generate price predictions
    const pricePredictions = {
      shortTerm: this.calculatePricePrediction(data, 'short'),
      mediumTerm: this.calculatePricePrediction(data, 'medium'),
      longTerm: this.calculatePricePrediction(data, 'long')
    };

    // Generate technical insights
    const technicalInsights = [
      this.generateTrendAnalysis(data),
      `RSI at ${data.technicalIndicators.rsi.toFixed(2)} indicates ${data.technicalIndicators.rsi > 70 ? 'overbought' : data.technicalIndicators.rsi < 30 ? 'oversold' : 'neutral'} conditions`,
      `MACD ${data.technicalIndicators.macd.histogram > 0 ? 'shows bullish' : 'shows bearish'} momentum`,
      `Price is ${data.price > data.technicalIndicators.sma20 ? 'above' : 'below'} 20-day moving average`
    ];

    // Generate risk assessment
    const riskAssessment = [
      `Volatility is ${volatilityScore > 70 ? 'high' : volatilityScore > 30 ? 'moderate' : 'low'}`,
      `Market sentiment is ${sentimentScore > 70 ? 'very positive' : sentimentScore > 30 ? 'neutral' : 'negative'}`,
      `Technical indicators suggest ${technicalScore > 70 ? 'strong' : technicalScore > 30 ? 'moderate' : 'weak'} trend`,
      `Risk level is ${this.calculateRiskLevel(data)}`
    ];

    // Generate recommendations
    const recommendations = [
      this.generatePositionRecommendation(data),
      this.generateEntryStrategy(data),
      this.generateExitStrategy(data),
      this.generateRiskManagementStrategy(data)
    ];

    return {
      prediction,
      confidenceScore,
      timestamp: new Date(),
      factors: this.identifyKeyFactors(data),
      pricePredictions: {
        shortTerm: pricePredictions.shortTerm,
        mediumTerm: pricePredictions.mediumTerm,
        longTerm: pricePredictions.longTerm
      },
      technicalInsights: technicalInsights,
      riskAssessment: riskAssessment,
      recommendations: recommendations
    };
  }

  private calculatePricePrediction(data: AnalysisData, timeframe: 'short' | 'medium' | 'long'): number {
    const baseChange = data.changePercent;
    const multiplier = timeframe === 'short' ? 1 : timeframe === 'medium' ? 2 : 3;
    return Math.round(baseChange * multiplier * 10) / 10;
  }

  private generatePositionRecommendation(data: AnalysisData): string {
    const score = this.calculateTechnicalScore(data);
    if (score > 70) return 'Consider taking a long position with strong technical indicators';
    if (score > 50) return 'Consider a moderate long position with positive indicators';
    if (score > 30) return 'Consider a small position with mixed indicators';
    return 'Consider waiting for better entry points';
  }

  private generateEntryStrategy(data: AnalysisData): string {
    const currentPrice = data.price;
    const sma20 = data.technicalIndicators.sma20;
    if (currentPrice > sma20) {
      return `Consider entering on pullbacks to ${sma20.toFixed(2)}`;
    }
    return `Consider entering on break above ${sma20.toFixed(2)}`;
  }

  private generateExitStrategy(data: AnalysisData): string {
    const stopLoss = this.calculateStopLoss(data, {
      technicalScore: this.calculateTechnicalScore(data),
      sentimentScore: this.calculateSentimentScore(data),
      momentumScore: this.calculateMomentumScore(data),
      trendScore: this.calculateTrendScore(data),
      volatilityScore: this.calculateVolatilityScore(data)
    });
    return `Set stop loss at ${stopLoss.toFixed(2)} and take profit at ${(data.price * 1.1).toFixed(2)}`;
  }

  private generateRiskManagementStrategy(data: AnalysisData): string {
    const volatility = Math.abs(data.changePercent);
    if (volatility > 5) {
      return 'Use tight stop losses and smaller position sizes due to high volatility';
    }
    return 'Standard position sizing and risk management rules apply';
  }

  private calculateRiskLevel(data: AnalysisData): string {
    const volatility = Math.abs(data.changePercent);
    const technicalScore = this.calculateTechnicalScore(data);
    const sentimentScore = this.calculateSentimentScore(data);

    if (volatility > 5 || technicalScore < 30 || sentimentScore < 30) {
      return 'high';
    }
    if (volatility > 3 || technicalScore < 50 || sentimentScore < 50) {
      return 'medium';
    }
    return 'low';
  }

  // Add method to clear cache for a specific symbol
  clearCache(symbol: string) {
    const twelveDataKey = this.getCacheKey(symbol, 'twelveData');
    const marketDataKey = this.getCacheKey(symbol, 'marketData');
    localStorage.removeItem(twelveDataKey);
    localStorage.removeItem(marketDataKey);
    console.log(`Cleared cache for ${symbol}`);
  }

  // Add method to clear all cache
  clearAllCache() {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.CACHE_PREFIX))
      .forEach(key => localStorage.removeItem(key));
    console.log('Cleared all analysis cache');
  }

  private clearCacheForCurrentSymbol(): void {
    if (this.symbol) {
      this.clearCache(this.symbol);
    }
  }

  private analyzeTrend(data: AnalysisData): string {
    const rsi = data.technicalIndicators.rsi;
    const macd = data.technicalIndicators.macd;
    const sma20 = data.technicalIndicators.sma20;
    const ema20 = data.technicalIndicators.ema20;
    const currentPrice = data.price;

    let trend = 'neutral';
    let strength = 0;

    // Price vs Moving Averages
    if (currentPrice > sma20 && currentPrice > ema20) {
      trend = 'bullish';
      strength += 2;
    } else if (currentPrice < sma20 && currentPrice < ema20) {
      trend = 'bearish';
      strength += 2;
    }

    // RSI Trend
    if (rsi > 60) {
      if (trend === 'bullish') strength += 1;
      else if (trend === 'neutral') trend = 'bullish';
    } else if (rsi < 40) {
      if (trend === 'bearish') strength += 1;
      else if (trend === 'neutral') trend = 'bearish';
    }

    // MACD Trend
    if (macd.histogram > 0 && macd.signal > 0) {
      if (trend === 'bullish') strength += 1;
      else if (trend === 'neutral') trend = 'bullish';
    } else if (macd.histogram < 0 && macd.signal < 0) {
      if (trend === 'bearish') strength += 1;
      else if (trend === 'neutral') trend = 'bearish';
    }

    return strength >= 2 ? `strong ${trend}` : trend;
  }

  private generateTrendAnalysis(data: AnalysisData): string {
    const trend = this.analyzeTrend(data);
    const rsi = data.technicalIndicators.rsi;
    const macd = data.technicalIndicators.macd;
    const sma20 = data.technicalIndicators.sma20;
    const ema20 = data.technicalIndicators.ema20;
    const currentPrice = data.price;

    let analysis = `Current trend is ${trend}. `;

    // Price Analysis
    if (currentPrice > sma20 && currentPrice > ema20) {
      analysis += 'Price is above both SMA20 and EMA20, indicating upward momentum. ';
    } else if (currentPrice < sma20 && currentPrice < ema20) {
      analysis += 'Price is below both SMA20 and EMA20, indicating downward momentum. ';
    } else {
      analysis += 'Price is between moving averages, showing mixed signals. ';
    }

    // RSI Analysis
    if (rsi > 70) {
      analysis += 'RSI indicates overbought conditions. ';
    } else if (rsi < 30) {
      analysis += 'RSI indicates oversold conditions. ';
    } else {
      analysis += 'RSI is in neutral territory. ';
    }

    // MACD Analysis
    if (macd.histogram > 0) {
      analysis += 'MACD shows bullish momentum. ';
    } else if (macd.histogram < 0) {
      analysis += 'MACD shows bearish momentum. ';
    } else {
      analysis += 'MACD is neutral. ';
    }

    return analysis;
  }

  private identifyPatterns(data: AnalysisData): string[] {
    const patterns: string[] = [];
    const rsi = data.technicalIndicators.rsi;
    const macd = data.technicalIndicators.macd;
    const sma20 = data.technicalIndicators.sma20;
    const ema20 = data.technicalIndicators.ema20;
    const currentPrice = data.price;

    // RSI Patterns
    if (rsi > 70) patterns.push('Overbought RSI');
    if (rsi < 30) patterns.push('Oversold RSI');
    if (rsi > 50 && rsi < 70) patterns.push('Bullish RSI');
    if (rsi < 50 && rsi > 30) patterns.push('Bearish RSI');

    // MACD Patterns
    if (macd.histogram > 0 && macd.signal > 0) patterns.push('Bullish MACD Crossover');
    if (macd.histogram < 0 && macd.signal < 0) patterns.push('Bearish MACD Crossover');
    if (Math.abs(macd.histogram) > 2) patterns.push('Strong MACD Divergence');

    // Moving Average Patterns
    if (currentPrice > sma20 && currentPrice > ema20) patterns.push('Golden Cross');
    if (currentPrice < sma20 && currentPrice < ema20) patterns.push('Death Cross');
    if (sma20 > ema20) patterns.push('Bullish Moving Average Alignment');
    if (sma20 < ema20) patterns.push('Bearish Moving Average Alignment');

    return patterns;
  }

  toggleAIAnalysis() {
    this.showAIAnalysis = !this.showAIAnalysis;
    if (this.showAIAnalysis && this.analysisData && !this.aiAnalysis) {
      this.aiAnalysis = this.generateAIAnalysis(this.analysisData);
    }
  }

  // Helper methods for AI Analysis UI
  getConfidenceColor(score: number): string {
    if (score >= 80) return 'success';
    if (score >= 60) return 'primary';
    if (score >= 40) return 'warning';
    return 'danger';
  }

  getFactorIcon(factor: string): string {
    if (factor.toLowerCase().includes('technical')) return 'analytics-outline';
    if (factor.toLowerCase().includes('sentiment')) return 'trending-up-outline';
    if (factor.toLowerCase().includes('momentum')) return 'speedometer-outline';
    if (factor.toLowerCase().includes('volatility')) return 'pulse-outline';
    if (factor.toLowerCase().includes('trend')) return 'trending-up-outline';
    return 'information-circle-outline';
  }

  getFactorColor(factor: string): string {
    if (factor.toLowerCase().includes('positive')) return 'success';
    if (factor.toLowerCase().includes('negative')) return 'danger';
    if (factor.toLowerCase().includes('neutral')) return 'medium';
    return 'primary';
  }

  getRiskIcon(risk: string): string {
    if (risk.toLowerCase().includes('high')) return 'warning-outline';
    if (risk.toLowerCase().includes('medium')) return 'alert-outline';
    if (risk.toLowerCase().includes('low')) return 'checkmark-circle-outline';
    return 'information-circle-outline';
  }

  getRiskColor(risk: string): string {
    if (risk.toLowerCase().includes('high')) return 'danger';
    if (risk.toLowerCase().includes('medium')) return 'warning';
    if (risk.toLowerCase().includes('low')) return 'success';
    return 'medium';
  }

  private calculateTechnicalScore(data: AnalysisData): number {
    const rsi = data.technicalIndicators.rsi;
    const macd = data.technicalIndicators.macd;
    const sma20 = data.technicalIndicators.sma20;
    const ema20 = data.technicalIndicators.ema20;
    const currentPrice = data.price;

    let score = 50; // Start with neutral score

    // RSI Analysis
    if (rsi > 70) score -= 20; // Overbought
    else if (rsi < 30) score += 20; // Oversold
    else if (rsi > 50) score += 10; // Bullish
    else if (rsi < 50) score -= 10; // Bearish

    // MACD Analysis
    if (macd.histogram > 0 && macd.signal > 0) score += 15; // Bullish
    else if (macd.histogram < 0 && macd.signal < 0) score -= 15; // Bearish

    // Moving Average Analysis
    if (currentPrice > sma20 && currentPrice > ema20) score += 15; // Bullish
    else if (currentPrice < sma20 && currentPrice < ema20) score -= 15; // Bearish

    return Math.max(0, Math.min(100, score));
  }

  private calculateSentimentScore(data: AnalysisData): number {
    const sentiment = data.sentiment.overallSentiment;
    const newsSentiment = data.sentiment.newsSentiment;

    let score = 50; // Start with neutral score

    // Overall sentiment impact
    if (sentiment === 'positive') score += 20;
    else if (sentiment === 'negative') score -= 20;

    // News sentiment impact
    const positiveNews = newsSentiment.filter(n => n.sentiment === 'positive').length;
    const negativeNews = newsSentiment.filter(n => n.sentiment === 'negative').length;
    const totalNews = newsSentiment.length;

    if (totalNews > 0) {
      const sentimentRatio = (positiveNews - negativeNews) / totalNews;
      score += sentimentRatio * 30;
    }

    return Math.max(0, Math.min(100, score));
  }

  private calculateMomentumScore(data: AnalysisData): number {
    const change = data.changePercent;
    const rsi = data.technicalIndicators.rsi;
    const macd = data.technicalIndicators.macd;

    let score = 50; // Start with neutral score

    // Price change impact
    if (change > 2) score += 20;
    else if (change < -2) score -= 20;
    else if (change > 0) score += 10;
    else if (change < 0) score -= 10;

    // RSI momentum
    if (rsi > 60) score += 15;
    else if (rsi < 40) score -= 15;

    // MACD momentum
    if (macd.histogram > 0) score += 15;
    else if (macd.histogram < 0) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private calculateVolatilityScore(data: AnalysisData): number {
    const change = Math.abs(data.changePercent);
    const rsi = data.technicalIndicators.rsi;

    let score = 50; // Start with neutral score

    // Price volatility
    if (change > 5) score += 30;
    else if (change > 3) score += 15;
    else if (change > 1) score += 5;

    // RSI volatility
    if (rsi > 70 || rsi < 30) score += 20;
    else if (rsi > 60 || rsi < 40) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  private calculateTrendScore(data: AnalysisData): number {
    const sma20 = data.technicalIndicators.sma20;
    const ema20 = data.technicalIndicators.ema20;
    const currentPrice = data.price;
    const macd = data.technicalIndicators.macd;

    let score = 50; // Start with neutral score

    // Price vs Moving Averages
    if (currentPrice > sma20 && currentPrice > ema20) score += 20;
    else if (currentPrice < sma20 && currentPrice < ema20) score -= 20;

    // MACD Trend
    if (macd.histogram > 0 && macd.signal > 0) score += 15;
    else if (macd.histogram < 0 && macd.signal < 0) score -= 15;

    // Moving Average Alignment
    if (sma20 > ema20) score += 15;
    else if (sma20 < ema20) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private generatePrediction(data: AnalysisData, scores: {
    technicalScore: number;
    sentimentScore: number;
    momentumScore: number;
    volatilityScore: number;
    trendScore: number;
  }): string {
    const { technicalScore, sentimentScore, momentumScore, volatilityScore, trendScore } = scores;
    const avgScore = (technicalScore + sentimentScore + momentumScore + trendScore) / 4;

    let prediction = '';
    if (avgScore > 70) {
      prediction = 'Strong bullish outlook with positive technical indicators and sentiment.';
    } else if (avgScore > 50) {
      prediction = 'Moderately bullish outlook with mixed technical indicators.';
    } else if (avgScore > 30) {
      prediction = 'Neutral outlook with mixed signals.';
    } else if (avgScore > 10) {
      prediction = 'Moderately bearish outlook with negative technical indicators.';
    } else {
      prediction = 'Strong bearish outlook with negative technical indicators and sentiment.';
    }

    if (volatilityScore > 70) {
      prediction += ' High volatility expected.';
    }

    return prediction;
  }

  private identifyKeyFactors(data: AnalysisData): string[] {
    const factors: string[] = [];
    const rsi = data.technicalIndicators.rsi;
    const macd = data.technicalIndicators.macd;
    const sma20 = data.technicalIndicators.sma20;
    const ema20 = data.technicalIndicators.ema20;
    const currentPrice = data.price;

    // Technical Factors
    if (rsi > 70) factors.push('Overbought RSI conditions');
    else if (rsi < 30) factors.push('Oversold RSI conditions');

    if (macd.histogram > 0 && macd.signal > 0) factors.push('Bullish MACD crossover');
    else if (macd.histogram < 0 && macd.signal < 0) factors.push('Bearish MACD crossover');

    if (currentPrice > sma20 && currentPrice > ema20) factors.push('Price above moving averages');
    else if (currentPrice < sma20 && currentPrice < ema20) factors.push('Price below moving averages');

    // Sentiment Factors
    if (data.sentiment.overallSentiment === 'positive') factors.push('Positive market sentiment');
    else if (data.sentiment.overallSentiment === 'negative') factors.push('Negative market sentiment');

    // Volatility Factors
    const volatility = Math.abs(data.changePercent);
    if (volatility > 5) factors.push('High volatility');
    else if (volatility > 3) factors.push('Moderate volatility');

    return factors;
  }

  private calculateStopLoss(data: AnalysisData, scores: {
    technicalScore: number;
    sentimentScore: number;
    momentumScore: number;
    trendScore: number;
    volatilityScore: number;
  }): number {
    const { volatilityScore } = scores;
    const currentPrice = data.price;
    const volatility = Math.abs(data.changePercent);

    // Calculate stop loss based on volatility
    const stopLossPercentage = Math.max(5, Math.min(15, volatility * 2));
    return currentPrice * (1 - stopLossPercentage / 100);
  }

  private calculateAction(data: AnalysisData): 'buy' | 'sell' | 'hold' {
    const score = this.calculateTechnicalScore(data);
    if (score > 70) return 'buy';
    if (score < 30) return 'sell';
    return 'hold';
  }

  private generateReasoning(data: AnalysisData): string {
    const score = this.calculateTechnicalScore(data);
    if (score > 70) {
      return 'The stock is in a strong bullish trend with positive technical indicators.';
    } else if (score < 30) {
      return 'The stock is in a strong bearish trend with negative technical indicators.';
    } else {
      return 'The stock is in a neutral trend with mixed technical indicators.';
    }
  }

  private getDataQualityScore(): number {
    const quality = this.getDataQuality();
    return (quality.completeness + quality.reliability + quality.freshness + quality.confidence) / 4;
  }

  private isDataQualityGood(): boolean {
    const score = this.getDataQualityScore();
    return score >= 0.7;
  }

  private isDataQualityExcellent(): boolean {
    const score = this.getDataQualityScore();
    return score >= 0.9;
  }

  private startRealTimeUpdates(): void {
    if (!this.symbol) return;

    this.analyzeStock(this.symbol).subscribe({
      next: (result) => {
        if (result) {
          this.twelveDataAnalysis = result.twelveDataAnalysis;
          this.marketDataAnalysis = result.marketDataAnalysis;
          this.analysisData = result.combinedAnalysis;
          this.aiAnalysis = this.generateAIAnalysis(result.combinedAnalysis);
        }
      },
      error: (error) => {
        console.error('Error in real-time updates:', error);
        this.error = 'Failed to update real-time data. Please try again later.';
      }
    });
  }

  private combineAnalysisData(twelveData: AnalysisData | null, marketData: AnalysisData | null): AnalysisData {
    const symbol = twelveData?.symbol || marketData?.symbol || '';
    
    // Combine data, preferring TwelveData values
    const combinedData: AnalysisData = {
      symbol,
      price: twelveData?.price || marketData?.price || 0,
      change: twelveData?.change || marketData?.change || 0,
      changePercent: twelveData?.changePercent || marketData?.changePercent || 0,
      technicalIndicators: {
        rsi: twelveData?.technicalIndicators?.rsi || marketData?.technicalIndicators?.rsi || 0,
        macd: {
          signal: twelveData?.technicalIndicators?.macd?.signal || marketData?.technicalIndicators?.macd?.signal || 0,
          histogram: twelveData?.technicalIndicators?.macd?.histogram || marketData?.technicalIndicators?.macd?.histogram || 0
        },
        sma20: twelveData?.technicalIndicators?.sma20 || marketData?.technicalIndicators?.sma20 || 0,
        ema20: twelveData?.technicalIndicators?.ema20 || marketData?.technicalIndicators?.ema20 || 0
      },
      sentiment: {
        overallSentiment: twelveData?.sentiment?.overallSentiment || marketData?.sentiment?.overallSentiment || 'neutral',
        newsSentiment: twelveData?.sentiment?.newsSentiment || marketData?.sentiment?.newsSentiment || []
      },
      dataQuality: {
        completeness: 0,
        reliability: 0,
        freshness: 0,
        confidence: 0
      },
      lastUpdated: new Date(),
      source: 'combined'
    };

    // Calculate data quality
    combinedData.dataQuality = this.calculateDataQuality(combinedData);
    
    return combinedData;
  }
} 