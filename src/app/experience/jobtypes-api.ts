import { Injectable, inject } from '@angular/core';
import { LIBRECHAT_TENANT_ID } from './librechat-config';
import { AuthSession } from './auth-session';

const BASE_URL = 'https://aidouble.dev.gosure.ai';

// Reference/master-list job type behind Business Category — only exposes
// its full contents via the job-types-by-id route below, not the name-based
// one every other call here uses (that route silently under-scopes results
// for this tenant/token). ID is stable per tenant; found via GET /api/v1/job-types.
const BUSINESS_CATEGORY_JOB_TYPE_ID = '69c38fc002993404d3d606ba';

interface CategoryRefData {
  Name?: string;
}

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

export interface NewCatalogItem {
  name: string;
  description: string;
  price?: string;
}

export interface CatalogResult {
  business: JobInstance<BusinessData>;
  /** Names of the Services/Products that could not be created. The Business
   *  itself succeeded whenever this resolves at all. */
  failed: string[];
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

  // The by-id route returns every instance directly as an array — no
  // wrapper, no working query params (adding filters/pagination here 500s),
  // so this always fetches the whole (small) reference list and any
  // filtering happens client-side.
  private async fetchByJobTypeId<T>(jobTypeId: string): Promise<JobInstance<T>[]> {
    const url = `${BASE_URL}/api/v1/job-types/${encodeURIComponent(jobTypeId)}/job-instances`;
    const res = await fetch(url, {
      headers: { 'X-Tenant': LIBRECHAT_TENANT_ID, Authorization: `Bearer ${this.session.token()}` },
    });
    if (!res.ok) {
      throw new Error(`GET job-type ${jobTypeId} instances ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const body = await res.json();
    return Array.isArray(body) ? body : [];
  }

  listBusinesses(category: string): Promise<JobInstance<BusinessData>[]> {
    return this.fetchInstances<BusinessData>('Business', [
      { fieldName: 'Business Category', condition: 'contains', value: category },
    ]);
  }

  // The real master list of valid categories — what "About your business"
  // offers as existing choices. Business Category validates against this
  // fixed list server-side (see createBusinessCategory below), so free text
  // not already here would just be rejected on submit.
  async listBusinessCategories(): Promise<string[]> {
    const categories = await this.fetchByJobTypeId<CategoryRefData>(BUSINESS_CATEGORY_JOB_TYPE_ID);
    const names = new Set<string>();
    for (const c of categories) {
      const name = c.data.Name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }

  // Creates an instance on the authenticated endpoint (not the public
  // /api/v1/public/create-instance one) — the public path's org attribution
  // is unreliable (the same request lands under a different, effectively
  // random org on repeat calls), while this one always attributes to the
  // token's own org. Needs a real session token; falls back to
  // LIBRECHAT_DEMO_TOKEN (via AuthSession.token()) for a signed-out visitor.
  // parentJobInstanceId is what makes an instance a subjob of another — the
  // POST body maps straight onto the stored record (ongo-core's
  // JobInstanceService.getJobInstance copies it verbatim), and it is the same
  // field listServices/listProducts below filter on. Services and Products
  // are unreachable from their Business without it.
  async createInstance<T = Record<string, unknown>>(
    jobTypeName: string,
    data: Record<string, unknown>,
    parentJobInstanceId?: string,
  ): Promise<JobInstance<T>> {
    const url = `${BASE_URL}/api/v1/job-types/name/${encodeURIComponent(jobTypeName)}/instances`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant': LIBRECHAT_TENANT_ID,
        Authorization: `Bearer ${this.session.token()}`,
      },
      body: JSON.stringify(parentJobInstanceId ? { data, parentJobInstanceId } : { data }),
    });
    if (!res.ok) {
      throw new Error(await this.messageFrom(res));
    }
    return res.json();
  }

  private async messageFrom(res: Response): Promise<string> {
    const body = await res.json().catch(() => null);

    const validationErrors = body?.validationErrors;
    if (Array.isArray(validationErrors) && validationErrors.length) {
      const problems = validationErrors
        .flatMap((entry: Record<string, string>) => Object.entries(entry))
        .map(([field, problem]) => `${field}: ${problem}`);
      if (problems.length) return problems.join(' · ');
    }

    const messages = body?.messages;
    if (Array.isArray(messages) && messages.length) return String(messages[0]);

    return 'Something went wrong. Please try again.';
  }

  // Registers a brand-new category as a valid reference value before a
  // Business record can use it — Business Category only accepts values that
  // already exist as Business-BusinessCategory instances, so a genuinely new
  // name has to be created here first.
  async createBusinessCategory(name: string): Promise<void> {
    await this.createInstance('Business-BusinessCategory', { Name: name });
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

  // Creates a Business and its catalogue in one pass. The Business has to
  // land first, because its id is the parentJobInstanceId every Service and
  // Product below is linked by. Children are created one at a time so a
  // failure names the row that broke rather than failing the whole batch
  // anonymously; the Business itself is already saved by then, so a partial
  // catalogue is recoverable by adding the rest rather than starting over.
  async createBusinessWithCatalog(
    business: Record<string, unknown>,
    services: NewCatalogItem[],
    products: NewCatalogItem[],
  ): Promise<CatalogResult> {
    const created = await this.createInstance<BusinessData>('Business', business);
    const businessName = String(business['Business Name'] ?? '');
    const failed: string[] = [];

    for (const service of services) {
      try {
        await this.createInstance(
          'Services',
          this.compact({
            'Service Name': service.name,
            'AI Description': service.description,
            'Business Name': businessName,
          }),
          created.id,
        );
      } catch {
        failed.push(service.name);
      }
    }

    for (const product of products) {
      try {
        await this.createInstance(
          'Products',
          this.compact({
            'Product Name': product.name,
            'AI Description': product.description,
            Price: product.price ?? '',
            'Business Name': businessName,
          }),
          created.id,
        );
      } catch {
        failed.push(product.name);
      }
    }

    return { business: created, failed };
  }

  private compact(fields: Record<string, string>): Record<string, string> {
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      const trimmed = value.trim();
      if (trimmed) data[key] = trimmed;
    }
    return data;
  }
}
