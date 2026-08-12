import { Injectable } from '@angular/core';

const BASE_URL = 'https://aidouble.dev.gosure.ai';
const TENANT = 'aidouble';

// Ships inside the public AIdouble JS bundle, same exposure as
// LIBRECHAT_DEMO_TOKEN in librechat-config.ts — but a stronger one, since
// these are live credentials that can re-mint a fresh admin token
// indefinitely rather than a token that just eventually expires. Only ever
// use an account scoped to this tenant's own browsing/demo data, never a
// real personal or org-wide admin. The durable fix is the same one noted on
// LIBRECHAT_DEMO_TOKEN: a public read-proxy endpoint that holds real
// credentials server-side, swapped in once one exists.
const ADMIN_USERNAME = 'aidouble@gosure.ai';
const ADMIN_PASSWORD = '123456';

// The person the agent believes it is talking to on the live-demo route.
// Same exposure warning as the admin credentials above: this ships in the
// public bundle, so it must stay an account that holds nothing but demo data.
const SAMPLE_USERNAME = 'aidoublesample@aidouble.com';
const SAMPLE_PASSWORD = 'Gosure@1234';

interface LoginResponse {
  token?: string;
  status?: string;
  username?: string;
  accountUserId?: string;
}

export interface AgentUser {
  token: string;
  accountUserId: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthApi {
  // Mints the token every unsigned-in visitor browses with — this is what
  // makes the demo show every business/category by default instead of
  // whatever subset a narrower-role token happens to see.
  async login(): Promise<string> {
    const body = await this.post(ADMIN_USERNAME, ADMIN_PASSWORD);
    return (body.token ?? '').trim();
  }

  // The identity the chat and voice agents run under on /cynosure. cokube
  // takes the agent's user from the login response's accountUserId rather
  // than from the token's own claims, so this keeps both and lets the caller
  // prefer the same field.
  async loginSampleUser(): Promise<AgentUser> {
    const body = await this.post(SAMPLE_USERNAME, SAMPLE_PASSWORD);
    return {
      token: (body.token ?? '').trim(),
      accountUserId: (body.accountUserId ?? '').trim(),
      username: (body.username ?? SAMPLE_USERNAME).trim(),
    };
  }

  private async post(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant': TENANT },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      throw new Error(`POST users/login ${res.status}: ${await res.text().catch(() => '')}`);
    }
    return (await res.json()) as LoginResponse;
  }
}
