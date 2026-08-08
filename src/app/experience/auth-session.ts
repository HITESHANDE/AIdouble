import { Injectable, computed, inject, signal } from '@angular/core';
import { LIBRECHAT_DEMO_TOKEN } from './librechat-config';
import { AdminAuthApi } from './admin-auth-api';

const TOKEN_KEY = 'aidouble_token';
const NAME_KEY = 'aidouble_user_name';

export interface SessionLoginResponse {
  status?: string;
  msg?: string;
  token?: string | null;
  username?: string | null;
  accountUserId?: string | null;
  accRoleName?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly adminAuth = inject(AdminAuthApi);

  private readonly stored = signal(this.read(TOKEN_KEY));
  // Fetched once at app startup (see loadAdminToken, called from an app
  // initializer) so an unsigned-in visitor still sees every business, not
  // just whatever a narrower-role static token happens to have visibility
  // into. A real sign-in always takes priority over it.
  private readonly adminToken = signal('');

  readonly userName = signal(this.read(NAME_KEY));
  readonly signedIn = computed(() => this.stored().length > 0);

  readonly token = computed(() => this.stored() || this.adminToken() || LIBRECHAT_DEMO_TOKEN);

  async loadAdminToken(): Promise<void> {
    try {
      const token = await this.adminAuth.login();
      if (token) this.adminToken.set(token);
    } catch (err) {
      console.warn('[auth-session] admin token fetch failed, falling back to the static demo token:', err);
    }
  }

  readonly displayName = computed(() => {
    const name = this.userName().trim();
    if (name) return name;

    const sub = this.claim('sub') || this.claim('username') || this.claim('email');
    if (sub) return sub.includes('@') ? sub.slice(0, sub.indexOf('@')) : sub;

    return 'Account';
  });

  readonly initial = computed(() => this.displayName().charAt(0).toUpperCase() || 'A');

  save(response: SessionLoginResponse) {
    const token = (response.token ?? '').trim();
    if (!token) return false;

    const name = (response.username ?? '').trim();
    this.stored.set(token);
    this.userName.set(name);
    this.write(TOKEN_KEY, token);
    this.write(NAME_KEY, name);
    return true;
  }

  clear() {
    this.stored.set('');
    this.userName.set('');
    this.write(TOKEN_KEY, '');
    this.write(NAME_KEY, '');
  }

  private claim(name: string): string {
    const payload = this.stored().split('.')[1];
    if (!payload) return '';
    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
      const value = (JSON.parse(atob(base64)) as Record<string, unknown>)[name];
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  }

  private read(key: string): string {
    if (typeof window === 'undefined' || !window.sessionStorage) return '';
    return window.sessionStorage.getItem(key) ?? '';
  }

  private write(key: string, value: string) {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
  }
}
