import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

const BASE_URL = 'https://aidouble.dev.gosure.ai';
const TENANT = 'aidouble';

export interface Idp {
  idp: string;
  displayName: string;
  logoSrc: string;
  brand: string;
  initial: string;
}

const DISPLAY_NAMES: Record<string, string> = {
  azure: 'Azure AD',
  azuread: 'Azure AD',
  microsoft: 'Microsoft',
  google: 'Google',
  okta: 'Okta',
  facebook: 'Facebook',
  github: 'GitHub',
  linkedin: 'LinkedIn',
  twitter: 'Twitter',
  salesforce: 'Salesforce',
  apple: 'Apple',
  slack: 'Slack',
  saml: 'SAML',
};

const BRANDS = ['google', 'microsoft', 'apple', 'linkedin'];

@Injectable({ providedIn: 'root' })
export class IdpsApi {
  private readonly http = inject(HttpClient);

  load(handlers: { next: (providers: Idp[]) => void; error: () => void }) {
    const url = `${BASE_URL}/api/v1/sso/idps`;
    const params = new HttpParams().set('tenantName', TENANT);

    this.http.get<unknown>(url, { params }).subscribe({
      next: (response) => handlers.next(this.normalise(response)),
      error: () => handlers.error(),
    });
  }

  private normalise(response: unknown): Idp[] {
    const raw = Array.isArray(response) ? response : [];
    const providers: Idp[] = [];

    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;

      const idp = this.clean(item['idp']);
      if (!idp) continue;

      const key = idp.toLowerCase();
      if (providers.some((existing) => existing.idp.toLowerCase() === key)) continue;

      const displayName =
        this.clean(item['displayName']) ||
        DISPLAY_NAMES[key] ||
        idp.charAt(0).toUpperCase() + idp.slice(1);

      providers.push({
        idp,
        displayName,
        logoSrc: this.usableUrl(this.clean(item['logoUrl'])),
        brand: BRANDS.find((brand) => key.includes(brand)) ?? '',
        initial: displayName.charAt(0).toUpperCase(),
      });
    }

    return providers;
  }

  private clean(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    const lower = text.toLowerCase();
    return lower === '' || lower === 'null' || lower === 'undefined' ? '' : text;
  }

  private usableUrl(value: string): string {
    return /^(https?:\/\/|data:)/i.test(value) ? value : '';
  }
}
