import { Component, ElementRef, HostListener, ViewChild, computed, inject, input, output, signal } from '@angular/core';
import { JobTypesApi, NewCatalogItem } from '../jobtypes-api';

export type KnowledgeType = 'Services' | 'Products' | 'Providers';

export type KnowledgeMode = 'docs' | 'business';

interface CatalogRow {
  name: string;
  description: string;
  price: string;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyRow = (): CatalogRow => ({ name: '', description: '', price: '' });

interface KnowledgeTypeInfo {
  key: KnowledgeType;
  hint: string;
}

interface KnowledgeDoc {
  type: KnowledgeType;
  name: string;
}

// Fixed for every business, regardless of industry — Services/Products are
// what a customer asks about, Providers is who actually delivers them.
const TYPES: KnowledgeTypeInfo[] = [
  { key: 'Services', hint: 'What you offer and how it works' },
  { key: 'Products', hint: 'What you sell, with pricing' },
  { key: 'Providers', hint: 'Who delivers it — staff, partners, locations' },
];

const MAX_DOCS = 5;
const SAMPLE_DOCS: KnowledgeDoc[] = [
  { type: 'Services', name: 'sample-services.csv' },
  { type: 'Products', name: 'sample-products.csv' },
];

type SourceTab = 'upload' | 'url' | 'text';

@Component({
  selector: 'app-xz-knowledge-modal',
  templateUrl: './knowledge-modal.html',
})
export class XzKnowledgeModal {
  private readonly jobTypes = inject(JobTypesApi);

  readonly businessName = input('');
  readonly category = input('');
  readonly closed = output<void>();
  /** Fired once a Business is saved, so the rail's Businesses panel can
   *  reload and show it without a page refresh. */
  readonly businessAdded = output<string>();

  protected readonly mode = signal<KnowledgeMode>('docs');

  protected readonly bizName = signal('');
  protected readonly bizDescription = signal('');
  protected readonly services = signal<CatalogRow[]>([emptyRow()]);
  protected readonly products = signal<CatalogRow[]>([emptyRow()]);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saved = signal('');

  protected setMode(mode: KnowledgeMode) {
    this.mode.set(mode);
    this.saveError.set('');
  }

  protected addRow(kind: 'services' | 'products') {
    const target = kind === 'services' ? this.services : this.products;
    target.update((rows) => [...rows, emptyRow()]);
  }

  protected removeRow(kind: 'services' | 'products', index: number) {
    const target = kind === 'services' ? this.services : this.products;
    target.update((rows) => (rows.length === 1 ? [emptyRow()] : rows.filter((_, i) => i !== index)));
  }

  protected updateRow(kind: 'services' | 'products', index: number, field: keyof CatalogRow, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const target = kind === 'services' ? this.services : this.products;
    target.update((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  private namedRows(rows: CatalogRow[]): NewCatalogItem[] {
    return rows
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), description: row.description.trim(), price: row.price.trim() }));
  }

  protected readonly canSave = computed(() => this.bizName().trim().length > 1 && !this.saving());

  protected async saveBusiness() {
    if (!this.canSave()) return;

    this.saving.set(true);
    this.saveError.set('');
    this.saved.set('');

    const services = this.namedRows(this.services());
    const products = this.namedRows(this.products());

    try {
      // Availabilty Hours has to be sent explicitly — the job type's own
      // server-side default fails its validation. Business Category comes
      // from the industry already selected in the rail, so it is always a
      // value the reference list accepts.
      const result = await this.jobTypes.createBusinessWithCatalog(
        {
          'Business Name': this.bizName().trim(),
          'Business Category': this.category(),
          ...(this.bizDescription().trim() ? { 'Short Description': this.bizDescription().trim() } : {}),
          'Availabilty Hours': ALL_DAYS,
        },
        services,
        products,
      );

      this.saving.set(false);
      this.businessAdded.emit(this.bizName().trim());

      const total = services.length + products.length;
      const added = total - result.failed.length;
      this.saved.set(
        result.failed.length
          ? `Saved with ${added} of ${total} entries. These could not be added: ${result.failed.join(', ')}.`
          : `Saved${total ? ` with ${services.length} service${services.length === 1 ? '' : 's'} and ${products.length} product${products.length === 1 ? '' : 's'}` : ''}.`,
      );

      this.bizName.set('');
      this.bizDescription.set('');
      this.services.set([emptyRow()]);
      this.products.set([emptyRow()]);
    } catch (err) {
      this.saving.set(false);
      this.saveError.set(err instanceof Error ? err.message : 'Could not save this business. Please try again.');
    }
  }

  protected readonly types = TYPES;
  protected readonly maxDocs = MAX_DOCS;
  protected readonly sourceTab = signal<SourceTab>('upload');
  protected readonly dragging = signal(false);
  protected readonly docs = signal<KnowledgeDoc[]>([]);
  protected readonly docsCount = computed(() => this.docs().length);
  protected readonly atLimit = computed(() => this.docsCount() >= MAX_DOCS);

  private pendingType: KnowledgeType = 'Services';

  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  protected addFilesFor(type: KnowledgeType) {
    if (this.atLimit()) return;
    this.pendingType = type;
    this.fileInput?.nativeElement.click();
  }

  protected onFilesSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    this.addFiles(files);
    (event.target as HTMLInputElement).value = '';
  }

  protected dragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected dragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
  }

  protected drop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(event.dataTransfer?.files ?? null);
  }

  private addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_DOCS - this.docsCount();
    if (room <= 0) return;
    const added = Array.from(files)
      .slice(0, room)
      .map((f): KnowledgeDoc => ({ type: this.pendingType, name: f.name }));
    this.docs.update((list) => [...list, ...added]);
  }

  protected loadSample() {
    const room = MAX_DOCS - this.docsCount();
    if (room <= 0) return;
    this.docs.update((list) => [...list, ...SAMPLE_DOCS.slice(0, room)]);
  }

  protected removeDoc(index: number) {
    this.docs.update((list) => list.filter((_, i) => i !== index));
  }

  protected close() {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.close();
  }
}
