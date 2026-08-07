import { Injectable, inject, signal } from '@angular/core';
import { ModuleConstantsApi } from './moduleconstants-api';
import { Idp, IdpsApi } from './idps-api';
import { SsoApi } from './sso-api';

@Injectable({ providedIn: 'root' })
export class AuthFlow {
  private readonly moduleConstants = inject(ModuleConstantsApi);
  private readonly idps = inject(IdpsApi);
  private readonly sso = inject(SsoApi);

  readonly redirecting = signal('');

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly source = signal('');
  readonly providers = signal<Idp[]>([]);

  start(source: string) {
    if (this.loading()) return;

    this.source.set(source);
    this.loading.set(true);
    this.error.set('');

    this.moduleConstants.load({
      next: () => this.loadProviders(),
      error: (message) => {
        this.loading.set(false);
        this.error.set(message);
      },
    });
  }

  signInWith(provider: Idp) {
    if (this.redirecting()) return;
    this.redirecting.set(provider.idp);
    window.location.href = this.sso.loginUrl(provider.idp);
  }

  close() {
    this.open.set(false);
  }

  clearError() {
    this.error.set('');
  }

  busyFor(source: string): boolean {
    return this.loading() && this.source() === source;
  }

  errorFor(source: string): string {
    return this.source() === source ? this.error() : '';
  }

  private loadProviders() {
    this.idps.load({
      next: (providers) => this.show(providers),
      error: () => this.show([]),
    });
  }

  private show(providers: Idp[]) {
    this.providers.set(providers);
    this.loading.set(false);
    this.open.set(true);
  }
}
