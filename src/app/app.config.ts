import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { errorInterceptor } from './core/services/error.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Signals drive every view, so no zone.js change detection is needed.
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      // Route params arrive as component inputs, removing boilerplate subscriptions.
      withComponentInputBinding(),
      // Navigating to a new page should start at the top; back should restore position.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
  ],
};
