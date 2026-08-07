import { Component, computed, input, signal } from '@angular/core';
import { DEPLOYMENT_CHANNELS } from '../experience-data';

interface WidgetMsg {
  role: 'ai' | 'user';
  text: string;
  source?: string;
}

// Illustrative widget-preview chat — a fixed example (not tied to live data)
// so the "where it lives" preview has something to click through.
const WIDGET_QUESTIONS: { q: string; a: string; source: string }[] = [
  {
    q: 'Am I overpaying on my car insurance?',
    a: "Your renewal quote is close to market rate — within 4%. If you'd like, I can pull three comparable quotes from our panel insurers.",
    source: 'Motor_Rate_Card_2026.pdf',
  },
  {
    q: 'Can we go cashless at the hospital?',
    a: "Yes — you're on the cashless network at 6,200+ hospitals. I've sent the nearest three near your saved address.",
    source: 'Network_Hospital_List.pdf',
  },
  {
    q: "Anything I'm missing this week?",
    a: 'Your two-wheeler policy renews in 9 days. Want me to renew it now at the locked-in rate?',
    source: 'Policy_Admin_System',
  },
];

@Component({
  selector: 'app-xz-channels',
  templateUrl: './channels.html',
})
export class XzChannels {
  readonly brandName = input('');
  protected readonly displayName = computed(() => this.brandName().trim() || 'Cynosure');
  protected readonly brandInitial = computed(() => this.displayName().slice(0, 1).toUpperCase());
  protected readonly brandInitials2 = computed(() => this.displayName().slice(0, 2).toUpperCase());
  protected readonly brandSlug = computed(
    () => this.displayName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'yourbrand',
  );

  /** Swaps the literal "AI Double" out of the static deployment-channel copy
   *  for the current preview name — used for the one directory-channel entry
   *  that mentions it by name. */
  protected withBrand(text: string): string {
    return text.replace(/AI Double/g, this.displayName());
  }

  protected readonly channels = DEPLOYMENT_CHANNELS;
  protected readonly activeId = signal(DEPLOYMENT_CHANNELS[0].id);

  protected readonly active = () => this.channels.find((c) => c.id === this.activeId())!;

  protected readonly widgetOpen = signal(false);
  protected readonly widgetQuestions = WIDGET_QUESTIONS;
  protected readonly widgetMessages = signal<WidgetMsg[]>([
    { role: 'ai', text: 'Hello — I can answer about your insurance. What do you need?' },
  ]);
  protected readonly copyLabel = signal('Copy');

  protected select(id: string) {
    this.activeId.set(id);
    this.widgetOpen.set(false);
    this.widgetMessages.set([{ role: 'ai', text: 'Hello — I can answer about your insurance. What do you need?' }]);
  }

  protected openWidget() {
    this.widgetOpen.set(true);
  }

  protected closeWidget() {
    this.widgetOpen.set(false);
  }

  protected chipLabel(q: string): string {
    return q.length > 34 ? q.slice(0, 32) + '…' : q;
  }

  protected askWidget(item: (typeof WIDGET_QUESTIONS)[number]) {
    this.widgetMessages.update((list) => [...list, { role: 'user', text: item.q }]);
    setTimeout(() => {
      this.widgetMessages.update((list) => [...list, { role: 'ai', text: item.a, source: item.source }]);
    }, 500);
  }

  protected readonly embedSnippet = computed(
    () =>
      `<script src="https://cdn.aidouble.ai/v1/widget.js"\n        data-agent="${this.brandSlug()}-insurance"\n        data-launcher="call,whatsapp,chat"\n        data-position="right" async></script>`,
  );

  protected copySnippet() {
    navigator.clipboard?.writeText(this.embedSnippet());
    this.copyLabel.set('Copied');
    setTimeout(() => this.copyLabel.set('Copy'), 1600);
  }
}
