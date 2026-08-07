import { Injectable, inject, signal } from '@angular/core';
import { ModuleConstantsApi } from './moduleconstants-api';
import { Idp, IdpsApi } from './idps-api';
import { SsoApi } from './sso-api';
import { JobTypesApi } from './jobtypes-api';
import { InstanceData } from '../signup/signup-api';

export type AuthStep = 'providers' | 'business';

export interface BusinessCreated {
  name: string;
  category: string;
}

@Injectable({ providedIn: 'root' })
export class AuthFlow {
  private readonly moduleConstants = inject(ModuleConstantsApi);
  private readonly idps = inject(IdpsApi);
  private readonly sso = inject(SsoApi);
  private readonly jobTypes = inject(JobTypesApi);

  readonly redirecting = signal('');

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly source = signal('');
  readonly providers = signal<Idp[]>([]);

  readonly step = signal<AuthStep>('providers');
  readonly categories = signal<string[]>([]);
  readonly categoriesLoading = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal('');

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
    this.step.set('providers');
    this.submitError.set('');
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

  // Called by AuthRedirect once the real SSO session token is saved. The
  // provider redirect is a full page navigation, so this fires on a freshly
  // bootstrapped app instance — reopening here (rather than assuming it's
  // still open from before the redirect) is what actually shows step 2 once
  // AuthRedirect's own in-app navigate back to "/" completes.
  completeLogin() {
    this.step.set('business');
    this.open.set(true);
    this.loadCategories();
  }

  async submitBusiness(
    data: InstanceData,
    handlers: { next: (created: BusinessCreated) => void; error: (message: string) => void },
  ) {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set('');

    const category = String(data['Business Category'] ?? '').trim();
    const isNewCategory = category !== '' && !this.categories().includes(category);

    if (isNewCategory) {
      try {
        await this.jobTypes.createBusinessCategory(category);
        this.categories.update((list) => [...list, category].sort((a, b) => a.localeCompare(b)));
      } catch {
        this.submitting.set(false);
        const message = 'Could not register the new category. Please try again or pick an existing one.';
        this.submitError.set(message);
        handlers.error(message);
        return;
      }
    }

    try {
      await this.jobTypes.createInstance('Business', data);
      this.submitting.set(false);
      handlers.next({ name: String(data['Business Name'] ?? ''), category });
    } catch (err) {
      this.submitting.set(false);
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      this.submitError.set(message);
      handlers.error(message);
    }
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

  private loadCategories() {
    this.categoriesLoading.set(true);
    this.jobTypes
      .listBusinessCategories()
      .then((categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      })
      .catch(() => {
        this.categories.set([]);
        this.categoriesLoading.set(false);
      });
  }
}
