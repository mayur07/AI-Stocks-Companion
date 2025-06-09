import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { NewsPage } from './pages/news/news.page';
import { AnalysisPage } from './pages/analysis/analysis.page';
import { StockDetailsPage } from './pages/stock-details/stock-details.page';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardPage },
  { path: 'news', component: NewsPage },
  { path: 'analysis', component: AnalysisPage },
  { path: 'stock/:symbol', component: StockDetailsPage },
  {
    path: 'twitter-feed',
    loadComponent: () => import('./pages/twitter-feed/twitter-feed.page').then(m => m.TwitterFeedPage)
  }
];
