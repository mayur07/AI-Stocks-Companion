import { Component, OnInit, OnDestroy } from '@angular/core';
import { TwitterService, Tweet } from '../../services/twitter.service';
import { TwitterSentimentService } from '../../services/twitter-sentiment.service';
import { TwitterSignalService, TradingSignal } from '../../services/twitter-signal.service';
import { Subscription, interval } from 'rxjs';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-twitter-feed',
  templateUrl: './twitter-feed.page.html',
  styleUrls: ['./twitter-feed.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class TwitterFeedPage implements OnInit, OnDestroy {
  tweets: Tweet[] = [];
  signals: TradingSignal[] = [];
  loading = false;
  error: string | null = null;
  private subscription: Subscription | null = null;
  private topics = ['bitcoin', 'stock market', 'crypto', 'trading'];
  private currentTopicIndex = 0;

  constructor(
    private twitterService: TwitterService,
    private sentimentService: TwitterSentimentService,
    private signalService: TwitterSignalService
  ) {}

  ngOnInit() {
    this.loadTweets();
    // Refresh tweets every 5 minutes
    this.subscription = interval(5 * 60 * 1000).subscribe(() => {
      this.loadTweets();
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  loadTweets() {
    this.loading = true;
    this.error = null;

    const currentTopic = this.topics[this.currentTopicIndex];
    this.currentTopicIndex = (this.currentTopicIndex + 1) % this.topics.length;

    this.twitterService.getTopicTweets(currentTopic).subscribe({
      next: (newTweets) => {
        this.tweets = [...newTweets, ...this.tweets].slice(0, 100);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading tweets:', error);
        this.error = 'Failed to load tweets. Please try again later.';
        this.loading = false;
      }
    });
  }

  refreshFeed(event?: any) {
    this.loading = true;
    this.error = null;
    
    // Clear existing tweets and signals
    this.tweets = [];
    this.signals = [];
    
    // Load new tweets
    this.loadTweets();
    
    // Complete the refresh event if it exists
    if (event) {
      event.target.complete();
    }
  }
} 