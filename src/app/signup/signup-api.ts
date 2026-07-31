import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

const BASE_URL = 'https://dev.gosure.ai';
const TENANT = 'aidouble';

export type JobTypeName = 'Members' | 'Business' | 'Brokers';

export type InstanceData = Record<string, string | string[]>;

export interface JobInstance {
  id?: string;
  jobInstanceId?: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class SignupApi {
  private readonly http = inject(HttpClient);

  createInstance(
    jobTypeName: JobTypeName,
    data: InstanceData,
    handlers: { next: (instance: JobInstance) => void; error: (message: string) => void },
  ) {
    const url = `${BASE_URL}/api/v1/public/create-instance?jobTypeName=${encodeURIComponent(jobTypeName)}`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'X-Tenant': TENANT });

    this.http.post<JobInstance>(url, { data }, { headers }).subscribe({
      next: (instance) => handlers.next(instance),
      error: (response) => handlers.error(this.messageFrom(response)),
    });
  }

  private messageFrom(response: unknown): string {
    const body = (response as { error?: unknown })?.error;

    const validationErrors = (body as { validationErrors?: unknown })?.validationErrors;
    if (Array.isArray(validationErrors) && validationErrors.length) {
      const problems = validationErrors
        .flatMap((entry) => Object.entries(entry as Record<string, string>))
        .map(([field, problem]) => `${field}: ${problem}`);
      if (problems.length) {
        return problems.join(' · ');
      }
    }

    const messages = (body as { messages?: unknown })?.messages;
    if (Array.isArray(messages) && messages.length) {
      return String(messages[0]);
    }

    const status = (response as { status?: number })?.status;
    if (status === 0) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    return 'Something went wrong. Please try again.';
  }
}
