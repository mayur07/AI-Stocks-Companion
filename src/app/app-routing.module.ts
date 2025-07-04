import { NgModule } from "@angular/core";
import { PreloadAllModules, RouterModule, Routes } from "@angular/router";

const routes: Routes = [{ path: "", redirectTo: "dashboard", pathMatch: "full" }, { path: "dashboard", loadChildren: () => import("./pages/dashboard/dashboard.module").then(m => m.DashboardPageModule) }, { path: "watchlist", loadComponent: () => import("./pages/watchlist/watchlist.page").then(m => m.WatchlistPage) }, { path: "news", loadChildren: () => import("./pages/news/news.module").then(m => m.NewsPageModule) }, { path: "analysis", loadComponent: () => import("./pages/analysis/analysis.page").then(m => m.AnalysisPage) }, { path: "stock/:symbol", loadComponent: () => import("./pages/stock-details/stock-details.page").then(m => m.StockDetailsPage) }];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
