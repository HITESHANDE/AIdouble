import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { AuthSession } from './experience/auth-session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(
      routes,
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    // Blocks bootstrap on the admin-token fetch so every component's first
    // data load already has a working token — without this, the workbench's
    // own ngOnInit could fire before the async login resolves and show a
    // transient "couldn't load" error on first paint.
    provideAppInitializer(() => inject(AuthSession).loadAdminToken()),
  ],
};
