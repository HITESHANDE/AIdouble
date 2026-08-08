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

interface LoginResponse {
  token?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthApi {
  // Mints the token every unsigned-in visitor browses with — this is what
  // makes the demo show every business/category by default instead of
  // whatever subset a narrower-role token happens to see.
  async login(): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/v1/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant': TENANT },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) {
      throw new Error(`POST users/login ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const body = (await res.json()) as LoginResponse;
    return (body.token ?? '').trim();
  }
}
