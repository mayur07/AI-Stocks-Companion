import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, map } from 'rxjs/operators';

export interface Tweet {
  id: string;
  text: string;
  author: {
    id: string;
    username: string;
    name: string;
    profile_image_url?: string;
  };
  metrics: {
    retweets: number;
    replies: number;
    likes: number;
  };
  sentiment?: {
    score: number;
    label: string;
  };
  timestamp: Date;
  impactScore?: number;
}

@Injectable({
  providedIn: 'root'
})
export class TwitterService {
  private readonly API_URL = 'http://localhost:3000/api/twitter';

  constructor(private http: HttpClient) {}

  // Get recent tweets about a topic
  getTopicTweets(topic: string): Observable<Tweet[]> {
    return this.http.get<any>(`${this.API_URL}/topic/${encodeURIComponent(topic)}`).pipe(
      map(response => this.processTweets(response)),
      catchError(this.handleError)
    );
  }

  // Get user's recent tweets
  getUserTweets(username: string): Observable<Tweet[]> {
    return this.http.get<any>(`${this.API_URL}/user/${username}`).pipe(
      map(response => this.processTweets(response)),
      catchError(this.handleError)
    );
  }

  // Get tweet details
  getTweetDetails(tweetId: string): Observable<Tweet> {
    return this.http.get<any>(`${this.API_URL}/tweet/${tweetId}`).pipe(
      map(response => this.processTweet(response)),
      catchError(this.handleError)
    );
  }

  private processTweet(response: any): Tweet {
    const tweet = response.data;
    const author = response.includes?.users?.find((u: any) => u.id === tweet.author_id);
    
    return {
      id: tweet.id,
      text: tweet.text,
      author: {
        id: author.id,
        username: author.username,
        name: author.name,
        profile_image_url: author.profile_image_url
      },
      metrics: {
        retweets: tweet.public_metrics.retweet_count,
        replies: tweet.public_metrics.reply_count,
        likes: tweet.public_metrics.like_count
      },
      timestamp: new Date(tweet.created_at)
    };
  }

  private processTweets(response: any): Tweet[] {
    if (!response.data) return [];
    
    return response.data.map((tweet: any) => {
      const author = response.includes?.users?.find((u: any) => u.id === tweet.author_id);
      return {
        id: tweet.id,
        text: tweet.text,
        author: {
          id: author.id,
          username: author.username,
          name: author.name,
          profile_image_url: author.profile_image_url
        },
        metrics: {
          retweets: tweet.public_metrics.retweet_count,
          replies: tweet.public_metrics.reply_count,
          likes: tweet.public_metrics.like_count
        },
        timestamp: new Date(tweet.created_at)
      };
    });
  }

  private handleError(error: any) {
    console.error('Twitter API Error:', error);
    return throwError(() => new Error(error.message || 'An error occurred with the Twitter API'));
  }
} 