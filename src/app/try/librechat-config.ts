// LibreChat/GoSure backend the "Try It" widget talks to.
// See src/app/try/librechat-api.ts for how these are used.
export const LIBRECHAT_BASE_URL = 'https://librechat-backend-olj53mb3da-el.a.run.app';
export const LIBRECHAT_TENANT_ID = 'aidouble';

// PASTE A REAL TOKEN HERE TO GO LIVE.
//
// The backend requires an X-Gosure-Token from an authenticated GoSure session
// (sessionStorage['token'] after logging into the GoSure/cokube portal) — there
// is no anonymous path to this endpoint. Until this is set, the widget falls
// back to a local simulated demo (see Try.ngOnInit in try.ts).
//
// This file ships inside the public AIdouble JS bundle, so anyone can read
// whatever value is here. Only ever use a token from an account scoped to
// public-safe agents — never a personal or admin session — and expect it to
// need periodic rotation as the session expires. The durable fix is a public
// proxy endpoint on the GoSure backend (like /api/v1/public/create-instance,
// already used by src/app/signup/signup-api.ts) that holds the real token
// server-side; swap to that when it exists.
//
// Current token: tenant "aidouble", user hitesh.a@gosure.ai, role "Members" —
// expires 2026-08-12 08:35 UTC. It will stop working after that with no
// warning beyond the console.warn in Try.ngOnInit; rotate it before then to
// keep the live demo working. The X-User-Id sent to the backend is decoded
// from this token's own `userId` claim (see LibrechatApi.userId()), so the
// welcome/personalization the agent shows follows whoever's token this is.
export const LIBRECHAT_DEMO_TOKEN =
  'eyJhbGciOiJIUzUxMiJ9.eyJqdGkiOiJvbmdvLWp3dCIsInN1YiI6ImhpdGVzaC5hQGdvc3VyZS5haSIsImF1dGhvcml0aWVzIjpbXSwidGVuYW50IjoiYWlkb3VibGUiLCJvcmdJZCI6IjY5YzI4MDAzYjI2M2RkMDNiYzkyZDIxMCIsInJvbGVOYW1lIjoiTWVtYmVycyIsInVzZXJJZCI6IjZhNjc0NTdjOWI0ODU3ZjI0YmQ4ZTU1OSIsImlhdCI6MTc4NTkxODkwOCwiZXhwIjoxNzg2NTIzNzA4fQ.I3oPYme4xy8nFRCL0W-my9t8Ao9MeWZZLmKigNQeHMAehB8Ce6QtSF_G74YiiUkGA_u3hkL5tNW42bgTPDtRSg';
