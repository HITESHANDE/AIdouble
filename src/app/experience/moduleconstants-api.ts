import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

const BASE_URL = 'https://dev.gosure.ai';
const TENANT = 'aidouble';

@Injectable({ providedIn: 'root' })
export class ModuleConstantsApi {
  private readonly http = inject(HttpClient);

  load(handlers: { next: () => void; error: (message: string) => void }) {
    const url = `${BASE_URL}/accessible/api/v1/job-type/name/ModuleConstants/instances`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'X-Tenant': TENANT });

    this.http.get(url, { headers }).subscribe({
      next: () => handlers.next(),
      error: (response) => handlers.error(this.messageFrom(response)),
    });
  }

  private messageFrom(response: unknown): string {
    const status = (response as { status?: number })?.status;
    if (status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
