import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SessionLoginResponse } from './auth-session';

const BASE_URL = 'https://aidouble.dev.gosure.ai';
const TENANT = 'aidouble';

const REDIRECT_PATH = '/auth-redirect';

@Injectable({ providedIn: 'root' })
export class SsoApi {
  private readonly http = inject(HttpClient);

  redirectUrl(): string {
    return `${window.location.origin}${REDIRECT_PATH}`;
  }

  loginUrl(idp: string): string {
    const provider = encodeURIComponent(idp);
    const tenant = encodeURIComponent(TENANT);
    const redirect = encodeURIComponent(this.redirectUrl());
    return `${BASE_URL}/api/v1/sso/${provider}/login?tenantName=${tenant}&redirectUrl=${redirect}`;
  }

  sessionLogin(
    sessionId: string,
    handlers: { next: (response: SessionLoginResponse) => void; error: (message: string) => void },
  ) {
    const url = `${BASE_URL}/api/v1/users/sso/session-login?sessionId=${encodeURIComponent(sessionId)}`;
    const headers = new HttpHeaders({ 'X-Tenant': TENANT });

    this.http.post<SessionLoginResponse>(url, {}, { headers }).subscribe({
      next: (response) => handlers.next(response),
      error: (response) => handlers.error(this.messageFrom(response)),
    });
  }

  private messageFrom(response: unknown): string {
    const status = (response as { status?: number })?.status;
    if (status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    const body = (response as { error?: { msg?: string } })?.error;
    return body?.msg || 'Sign-in could not be completed. Please try again.';
  }
}
