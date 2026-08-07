import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SessionLoginResponse } from './auth-session';

const BASE_URL = 'https://aidouble.dev.gosure.ai';
const TENANT = 'aidouble';

interface EncryptionKeyResponse {
  encryptionKey?: string;
}

type Handlers = {
  next: (response: SessionLoginResponse) => void;
  error: (message: string) => void;
};

@Injectable({ providedIn: 'root' })
export class PasswordLoginApi {
  private readonly http = inject(HttpClient);
  private encryptionKey = '';

  login(username: string, password: string, handlers: Handlers) {
    if (this.encryptionKey) {
      void this.submit(username, password, handlers);
      return;
    }

    const headers = new HttpHeaders({ 'X-tenant': TENANT });

    this.http
      .get<EncryptionKeyResponse>(`${BASE_URL}/api/v1/users/generate/encryption-key`, { headers })
      .subscribe({
        next: (response) => {
          const key = (response?.encryptionKey ?? '').trim();
          if (!key) {
            handlers.error('Could not start a secure sign-in. Please try again.');
            return;
          }
          this.encryptionKey = key;
          void this.submit(username, password, handlers);
        },
        error: (response) => handlers.error(this.messageFrom(response)),
      });
  }

  private async submit(username: string, password: string, handlers: Handlers) {
    let payload: { username: string; password: string; encrypted: boolean };

    try {
      const key = await this.importKey(this.encryptionKey);
      payload = {
        username: await this.encrypt(username, key),
        password: await this.encrypt(password, key),
        encrypted: true,
      };
    } catch {
      this.encryptionKey = '';
      handlers.error('Could not secure your details. Please try again.');
      return;
    }

    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'X-Tenant': TENANT });

    this.http.post<SessionLoginResponse>(`${BASE_URL}/api/v1/users/login`, payload, { headers }).subscribe({
      next: (response) => handlers.next(response),
      error: (response) => handlers.error(this.messageFrom(response)),
    });
  }

  private importKey(base64Key: string): Promise<CryptoKey> {
    const raw = Uint8Array.from(atob(base64Key), (character) => character.charCodeAt(0));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  }

  private async encrypt(text: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(text),
    );

    const combined = new Uint8Array(iv.length + cipher.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(cipher), iv.length);

    let binary = '';
    combined.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private messageFrom(response: unknown): string {
    const status = (response as { status?: number })?.status;
    if (status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }

    const body = (response as { error?: { status?: string; msg?: string } })?.error;
    if (body?.status === 'Reset') {
      return 'Your password needs resetting. Please set a new one in the main portal, then come back.';
    }
    return body?.msg || 'Sign-in failed. Check your email and password.';
  }
}
