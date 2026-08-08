import { Component, ElementRef, HostListener, ViewChild, computed, input, output, signal } from '@angular/core';

export type KnowledgeType = 'Services' | 'Products' | 'Providers';

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
  readonly businessName = input('');
  readonly category = input('');
  readonly closed = output<void>();

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
