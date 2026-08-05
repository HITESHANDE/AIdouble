import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { marked } from 'marked';
import { LibrechatApi, parseConversationStarters } from '../librechat-api';
import { BusinessData, JobInstance, JobTypesApi, ProductData, ServiceData } from '../jobtypes-api';

export type XzMode = 'voice' | 'chat';

export interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
}

interface AgentOption {
  key: string;
  label: string;
  line: string;
  description: string | null;
  prompts: string[];
  /** Business Category filter value for this agent's business drill-down. */
  category: string;
}

// Only these agents currently have a real Business Category mapping; the
// rest of the tenant's agents are internal GoSure/cokube tooling with no
// consumer business behind them, so they're left out of this widget for now.
const AGENT_CATEGORY: Record<string, string> = {
  'Aidouble Insurance': 'Health Insurance',
  Education: 'Education',
  'Health Care': 'Healthcare',
  'Home Services': 'Home Services',
  'Medical Aesthetics': 'Medical Aesthetics',
};

// Shown until the real agent list loads (or if it can't — see ngOnInit).
const FALLBACK_AGENTS: AgentOption[] = [
  {
    key: 'insurance',
    label: 'Aidouble Insurance',
    line: 'Am I overpaying on my car renewal?',
    description: null,
    category: 'Health Insurance',
    prompts: [
      'Am I overpaying on my car renewal?',
      'Compare my premium to the going rate',
      'Explain what my policy actually covers',
      'Connect me to a verified advisor',
    ],
  },
  {
    key: 'education',
    label: 'Education',
    line: 'Find your education guru',
    description: null,
    category: 'Education',
    prompts: ['Find your education guru', 'What courses are available?', 'Book a tutoring session'],
  },
  {
    key: 'health',
    label: 'Health Care',
    line: 'What does my cover actually include?',
    description: null,
    category: 'Healthcare',
    prompts: [
      'What does my cover actually include?',
      'Remind me of my next appointment',
      'Get a second opinion from a professional',
    ],
  },
  {
    key: 'home',
    label: 'Home Services',
    line: 'Get instant help for all your home service needs.',
    description: null,
    category: 'Home Services',
    prompts: ['Get instant help for all your home service needs.', 'Book a repair visit', 'Any disputes I should know about?'],
  },
  {
    key: 'medaesthetics',
    label: 'Medical Aesthetics',
    line: 'How can I reduce forehead wrinkles?',
    description: null,
    category: 'Medical Aesthetics',
    prompts: [
      'How can I reduce forehead wrinkles?',
      'Recommend products for oily skin.',
      'How should I prepare for a chemical peel?',
    ],
  },
];

const GENERIC_PROMPT = 'Ask me anything.';
const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil'];

@Component({
  selector: 'app-xz-workbench',
  templateUrl: './workbench.html',
})
export class XzWorkbench implements OnInit {
  private readonly api = inject(LibrechatApi);
  private readonly jobTypesApi = inject(JobTypesApi);

  protected readonly agents = signal<AgentOption[]>(FALLBACK_AGENTS);
  protected readonly languages = LANGUAGES;

  /** True once a real agent list has loaded — gates whether we call the live
   *  API or fall back to the local simulated demo. */
  protected readonly live = signal(false);

  protected readonly mode = signal<XzMode>('voice');
  protected readonly agentKey = signal<string>(FALLBACK_AGENTS[0].key);
  protected readonly language = signal(LANGUAGES[0]);

  protected readonly agent = computed(
    () => this.agents().find((item) => item.key === this.agentKey()) ?? this.agents()[0],
  );

  // Business drill-down: agent's category -> businesses -> services + products
  protected readonly businesses = signal<JobInstance<BusinessData>[]>([]);
  protected readonly businessesLoading = signal(false);
  protected readonly businessesError = signal(false);
  protected readonly selectedBusinessId = signal<string | null>(null);
  protected readonly services = signal<JobInstance<ServiceData>[]>([]);
  protected readonly products = signal<JobInstance<ProductData>[]>([]);
  protected readonly servicesLoading = signal(false);
  protected readonly productsLoading = signal(false);

  protected readonly selectedBusiness = computed(
    () => this.businesses().find((b) => b.id === this.selectedBusinessId()) ?? null,
  );

  // Voice-call demo state
  protected readonly calling = signal(false);
  protected readonly connected = signal(false);

  // Chat demo state
  protected readonly chatMessages = signal<ChatMessage[]>([]);
  protected readonly chatPending = signal(false);
  protected readonly composerText = signal('');
  protected readonly suggestedReplies = signal<string[]>([]);
  private readonly conversationId = signal<string | null>(null);
  private readonly lastMessageId = signal<string | null>(null);

  // Dummy upload — accepts files for display only, no parsing/backend call.
  protected readonly uploadedFiles = signal<string[]>([]);

  protected onFilesSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files?.length) return;
    this.uploadedFiles.update((list) => [...list, ...Array.from(files, (f) => f.name)]);
  }

  private readonly detailedAgentKeys = new Set<string>();
  private businessRequestId = 0;
  private bizDetailRequestId = 0;

  ngOnInit() {
    this.loadBusinesses(this.agent().category);

    if (!this.api.isConfigured()) return; // no token yet — stay on the simulated demo
    this.api
      .listAgents()
      .then((list) => {
        const mapped = list
          .filter((a) => a.name && AGENT_CATEGORY[a.name.trim()])
          .map((a): AgentOption => {
            const name = a.name!.trim();
            const description = a.description?.trim() || null;
            return {
              key: a.id,
              label: name,
              line: description ?? GENERIC_PROMPT,
              description,
              category: AGENT_CATEGORY[name],
              prompts: [description ?? GENERIC_PROMPT],
            };
          });
        if (!mapped.length) return;
        this.agents.set(mapped);
        this.agentKey.set(mapped[0].key);
        this.live.set(true);
        this.loadAgentDetail(mapped[0].key);
        this.loadBusinesses(mapped[0].category);
      })
      .catch((err) => {
        console.warn('[workbench] live agent list unavailable, using simulated demo:', err);
      });
  }

  private loadAgentDetail(key: string) {
    if (!this.live() || this.detailedAgentKeys.has(key)) return;
    this.detailedAgentKeys.add(key);
    this.api
      .getAgent(key)
      .then((full) => {
        const prompts = parseConversationStarters(full.conversation_starters).slice(0, 4);
        if (!prompts.length) return;
        this.agents.update((list) =>
          list.map((a) => (a.key === key ? { ...a, line: prompts[0], prompts } : a)),
        );
      })
      .catch((err) => console.warn(`[workbench] could not load starter prompts for agent ${key}:`, err));
  }

  private loadBusinesses(category: string) {
    const requestId = ++this.businessRequestId;
    this.selectedBusinessId.set(null);
    this.services.set([]);
    this.products.set([]);
    this.businesses.set([]);
    this.businessesError.set(false);
    this.businessesLoading.set(true);
    this.jobTypesApi
      .listBusinesses(category)
      .then((list) => {
        if (requestId !== this.businessRequestId) return;
        this.businesses.set(list);
      })
      .catch((err) => {
        if (requestId !== this.businessRequestId) return;
        console.warn(`[workbench] could not load businesses for category ${category}:`, err);
        this.businessesError.set(true);
      })
      .finally(() => {
        if (requestId === this.businessRequestId) this.businessesLoading.set(false);
      });
  }

  protected selectBusiness(id: string) {
    if (this.selectedBusinessId() === id) return;
    this.selectedBusinessId.set(id);
    const requestId = ++this.bizDetailRequestId;

    this.servicesLoading.set(true);
    this.jobTypesApi
      .listServices(id)
      .then((list) => {
        if (requestId === this.bizDetailRequestId) this.services.set(list);
      })
      .catch((err) => console.warn('[workbench] could not load services:', err))
      .finally(() => {
        if (requestId === this.bizDetailRequestId) this.servicesLoading.set(false);
      });

    this.productsLoading.set(true);
    this.jobTypesApi
      .listProducts(id)
      .then((list) => {
        if (requestId === this.bizDetailRequestId) this.products.set(list);
      })
      .catch((err) => console.warn('[workbench] could not load products:', err))
      .finally(() => {
        if (requestId === this.bizDetailRequestId) this.productsLoading.set(false);
      });
  }

  protected backToBusinesses() {
    this.selectedBusinessId.set(null);
    this.services.set([]);
    this.products.set([]);
  }

  protected selectMode(mode: XzMode) {
    this.mode.set(mode);
    this.calling.set(false);
    this.connected.set(false);
  }

  protected selectAgent(key: string) {
    this.agentKey.set(key);
    this.loadAgentDetail(key);
    this.loadBusinesses(this.agent().category);
    this.calling.set(false);
    this.connected.set(false);
    this.chatMessages.set([]);
    this.chatPending.set(false);
    this.composerText.set('');
    this.suggestedReplies.set([]);
    this.conversationId.set(null);
    this.lastMessageId.set(null);
  }

  protected renderMarkdown(text: string): string {
    return marked.parse(text, { async: false, breaks: true });
  }

  protected hubLabel() {
    if (this.connected()) return 'Live now';
    if (this.calling()) return 'Connecting…';
    return 'Try call';
  }

  protected startDemo() {
    if (this.calling() || this.connected()) return;
    this.calling.set(true);

    if (this.live()) {
      this.api.sendAgentMessage({ text: this.agent().line, agentId: this.agentKey() }).subscribe({
        next: (evt) => {
          if (evt.final) {
            this.calling.set(false);
            this.connected.set(true);
            this.speak(evt.final.fullText);
          } else if (evt.error) {
            this.calling.set(false);
            this.connected.set(true);
          }
        },
        error: () => {
          this.calling.set(false);
          this.connected.set(true);
        },
      });
      return;
    }

    setTimeout(() => {
      this.calling.set(false);
      this.connected.set(true);
    }, 1500);
  }

  /** Speaks LibreChat's real reply aloud as a stand-in for LiveKit voice
   *  output, until real LiveKit room/audio plumbing is wired in. */
  private speak(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  protected sendMessage(text?: string) {
    const value = (text ?? this.composerText()).trim();
    if (!value || this.chatPending()) return;
    this.chatMessages.update((list) => [...list, { role: 'user', text: value }]);
    this.composerText.set('');
    this.suggestedReplies.set([]);
    this.chatPending.set(true);

    if (this.live()) {
      let started = false;
      this.api
        .sendAgentMessage({
          text: value,
          agentId: this.agentKey(),
          conversationId: this.conversationId(),
          parentMessageId: this.lastMessageId(),
        })
        .subscribe({
          next: (evt) => {
            if (evt.textDelta) {
              if (!started) {
                started = true;
                this.chatMessages.update((list) => [...list, { role: 'agent', text: evt.textDelta! }]);
              } else {
                this.chatMessages.update((list) => {
                  const copy = list.slice();
                  const last = copy[copy.length - 1];
                  copy[copy.length - 1] = { ...last, text: last.text + evt.textDelta };
                  return copy;
                });
              }
            } else if (evt.error) {
              this.chatMessages.update((list) => [...list, { role: 'agent', text: evt.error! }]);
              this.chatPending.set(false);
            } else if (evt.final) {
              this.conversationId.set(evt.final.conversationId || this.conversationId());
              this.lastMessageId.set(evt.final.responseMessageId || this.lastMessageId());
              this.chatPending.set(false);
              this.api
                .getSuggestedReplies(this.conversationId(), value, this.agent().description)
                .then((replies) => this.suggestedReplies.set(replies));
            }
          },
          error: () => {
            this.chatMessages.update((list) => [
              ...list,
              { role: 'agent', text: 'Could not reach the agent right now. Please try again.' },
            ]);
            this.chatPending.set(false);
          },
        });
      return;
    }

    const agentName = this.agent().label;
    setTimeout(() => {
      this.chatPending.set(false);
      this.chatMessages.update((list) => [
        ...list,
        { role: 'agent', text: `Once LibreChat is wired in, ${agentName}'s real answer shows up right here.` },
      ]);
    }, 1200);
  }
}
