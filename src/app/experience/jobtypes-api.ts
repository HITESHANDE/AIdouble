import { Injectable, inject } from '@angular/core';
import { LIBRECHAT_TENANT_ID } from './librechat-config';
import { AuthSession } from './auth-session';

const BASE_URL = 'https://aidouble.dev.gosure.ai';

export interface JobInstance<T = Record<string, unknown>> {
  id: string;
  parentJobInstanceId: string | null;
  data: T;
}

export interface BusinessData {
  'Business Name': string;
  'Short Description'?: string;
  'Business Address'?: string;
  'Website URL'?: string;
  'Business Type'?: string;
  'Business Category_ref'?: { label: string };
}

export interface ServiceData {
  'Service Name': string;
  'AI Description'?: string;
  Available?: string;
  'Business Name': string;
}

export interface ProductData {
  'Product Name': string;
  'AI Description'?: string;
  Price?: string;
  'Product Category'?: string;
  'Business Name': string;
  Image?: { fileUrl: string; fileName: string }[][];
}

interface JobInstancesResponse<T> {
  jobs?: JobInstance<T>[];
}

@Injectable({ providedIn: 'root' })
export class JobTypesApi {
  private readonly session = inject(AuthSession);

  private async fetchInstances<T>(
    jobType: string,
    filters: { fieldName: string; condition: string; value: string }[],
    pageSize = 100,
  ): Promise<JobInstance<T>[]> {
    const encodedFilters = encodeURIComponent(JSON.stringify(filters));
    const url = `${BASE_URL}/api/v1/job-types/name/${encodeURIComponent(jobType)}/instances?pageNumber=1&pageSize=${pageSize}&filters=${encodedFilters}`;
    const res = await fetch(url, {
      headers: { 'X-Tenant': LIBRECHAT_TENANT_ID, Authorization: `Bearer ${this.session.token()}` },
    });
    if (!res.ok) {
      throw new Error(`GET ${jobType} instances ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const body = (await res.json()) as JobInstancesResponse<T>;
    return Array.isArray(body?.jobs) ? body.jobs : [];
  }

  listBusinesses(category: string): Promise<JobInstance<BusinessData>[]> {
    return this.fetchInstances<BusinessData>('Business', [
      { fieldName: 'Business Category', condition: 'contains', value: category },
    ]);
  }

  // Services/Products are subjobs of Business — linked by parentJobInstanceId,
  // not by name. Some records ship with an empty "Business Name" field (e.g.
  // Cynosure Lutronic's one service), so filtering by name silently drops
  // them; matching on the real parent-child relationship is reliable.
  async listServices(businessId: string): Promise<JobInstance<ServiceData>[]> {
    const all = await this.fetchInstances<ServiceData>('Services', []);
    return all.filter((s) => s.parentJobInstanceId === businessId);
  }

  async listProducts(businessId: string): Promise<JobInstance<ProductData>[]> {
    const all = await this.fetchInstances<ProductData>('Products', []);
    return all.filter((p) => p.parentJobInstanceId === businessId);
  }
}
