import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';

// Path-based URLs (e.g. /artwork/icar/) instead of hash URLs (/#/artwork/Icar):
// search engines ignore everything after "#", so hash routes could never be indexed.
// Old hash links are redirected by a small script in src/index.html.
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient()
  ]
};
