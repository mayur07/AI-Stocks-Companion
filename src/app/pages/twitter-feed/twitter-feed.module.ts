import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TwitterFeedPageRoutingModule } from './twitter-feed-routing.module';
import { TwitterFeedPage } from './twitter-feed.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    TwitterFeedPageRoutingModule
  ],
  declarations: [TwitterFeedPage]
})
export class TwitterFeedPageModule {} 