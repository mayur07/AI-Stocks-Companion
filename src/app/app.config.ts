import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideHttpClient } from '@angular/common/http';

export const config: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideIonicAngular(),
    provideHttpClient()
  ]
}; 