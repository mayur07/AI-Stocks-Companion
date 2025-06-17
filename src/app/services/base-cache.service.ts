import { Injectable, Inject } from '@angular/core';

export interface CacheData {
  data: any;
  timestamp: number;
}

export const CACHE_PREFIX = 'CACHE_PREFIX';

@Injectable({
  providedIn: 'root'
})
export class BaseCacheService {
  protected readonly DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(@Inject(CACHE_PREFIX) protected readonly cachePrefix: string) {}

  protected getCachedData(key: string, duration: number = this.DEFAULT_CACHE_DURATION): any {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp }: CacheData = JSON.parse(cached);
      if (Date.now() - timestamp > duration) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  }

  protected cacheData(key: string, data: any): void {
    try {
      const cacheData: CacheData = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error writing to cache:', error);
    }
  }

  clearCache(): void {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(this.cachePrefix))
        .forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  clearSymbolCache(symbol: string): void {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(this.cachePrefix) && key.includes(symbol))
        .forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing symbol cache:', error);
    }
  }
} 