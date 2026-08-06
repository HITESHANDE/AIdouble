import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { marked } from 'marked';
import { LibrechatApi, parseConversationStarters } from '../librechat-api';
import { BusinessData, JobInstance, JobTypesApi, ProductData, ServiceData } from '../jobtypes-api';
import { LivekitVoice, VoiceState, VoiceTranscript } from '../livekit-voice';

export type XzMode = 'voice' | 'chat';

export interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
}

export interface VoiceLine {
  role: 'user' | 'agent';
  text: string;
  pending: boolean;
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
const LANGUAGES = ['English'];

@Component({
  selector: 'app-xz-workbench',
  templateUrl: './workbench.html',
})
export class XzWorkbench implements OnInit, OnDestroy {
  private readonly api = inject(LibrechatApi);
  private readonly jobTypesApi = inject(JobTypesApi);
  private readonly voice = inject(LivekitVoice);

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

  // Voice-call state. A live agent list means agentKey() is a real LibreChat
  // agent id, so the call goes to LiveKit; otherwise it stays simulated.
  protected readonly voiceState = signal<VoiceState>('idle');
  protected readonly voiceMuted = signal(false);
  protected readonly voiceError = signal<string | null>(null);
  protected readonly voiceNoiseFilterUnavailable = signal(false);
  protected readonly voiceLines = signal<VoiceLine[]>([]);
  /** What actually renders — drops lines that finished with no real content
   *  (e.g. noise the mic picked up, or a turn the agent had nothing to add
   *  to) instead of leaving an empty bubble in the transcript. */
  protected readonly visibleVoiceLines = computed(() =>
    this.voiceLines().filter((l) => l.pending || l.text.trim().length > 0),
  );
  /** Keyed by LiveKit's own transcription segment id — the reliable way to
   *  tell "this is an update to the utterance already on screen" apart from
   *  "this is a new one", regardless of how many segments a role has open. */
  private voicePartialIndex = new Map<string, number>();
  /** Per-line typewriter state — reveals a line progressively instead of
   *  popping the whole reply in at once when the worker sends it in one shot. */
  private readonly voiceReveal = new Map<number, { shown: number; timer?: ReturnType<typeof setInterval> }>();

  @ViewChild('vscript') private vscript?: ElementRef<HTMLElement>;

  protected readonly calling = computed(() => this.voiceState() === 'connecting');
  protected readonly connected = computed(
    () => this.voiceState() !== 'idle' && this.voiceState() !== 'error' && this.voiceState() !== 'connecting',
  );
  protected readonly voiceActive = computed(
    () => this.voiceState() !== 'idle' && this.voiceState() !== 'error',
  );
  /** True once "connecting"/"thinking" has dragged on a bit — reassures the
   *  caller instead of leaving a bare spinner during a slow worker join or reply. */
  protected readonly voiceWaitingLong = signal(false);
  private voiceWaitingTimer?: ReturnType<typeof setTimeout>;

  // Chat demo state
  protected readonly chatMessages = signal<ChatMessage[]>([]);
  protected readonly chatPending = signal(false);
  /** True only until the first token of the reply arrives — gates the
   *  "thinking" bubble so it doesn't linger alongside the growing answer. */
  protected readonly chatAwaitingFirstToken = signal(false);
  /** True once a reply has been waited on for a while — softens a slow
   *  agent/tool-call round trip with a reassurance line instead of silence. */
  protected readonly chatPendingLong = signal(false);
  protected readonly composerText = signal('');
  protected readonly suggestedReplies = signal<string[]>([]);
  private readonly conversationId = signal<string | null>(null);
  private readonly lastMessageId = signal<string | null>(null);
  private chatPendingTimer?: ReturnType<typeof setTimeout>;

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
    this.endCall();
  }

  protected selectAgent(key: string) {
    this.agentKey.set(key);
    this.loadAgentDetail(key);
    this.loadBusinesses(this.agent().category);
    this.endCall();
    this.chatMessages.set([]);
    this.chatPending.set(false);
    this.endAwaitingReply();
    this.composerText.set('');
    this.suggestedReplies.set([]);
    this.conversationId.set(null);
    this.lastMessageId.set(null);
  }

  protected renderMarkdown(text: string): string {
    return marked.parse(text, { async: false, breaks: true });
  }

  /** Starts the "thinking" bubble and, if a reply takes a while, a
   *  reassurance line — cleared as soon as the first token/error/final arrives. */
  private beginAwaitingReply() {
    this.chatAwaitingFirstToken.set(true);
    this.chatPendingLong.set(false);
    clearTimeout(this.chatPendingTimer);
    this.chatPendingTimer = setTimeout(() => this.chatPendingLong.set(true), 5000);
  }

  private endAwaitingReply() {
    this.chatAwaitingFirstToken.set(false);
    this.chatPendingLong.set(false);
    clearTimeout(this.chatPendingTimer);
  }

  protected hubLabel() {
    if (this.voiceActive()) return 'End call';
    return 'Try call';
  }

  protected statusLabel() {
    switch (this.voiceState()) {
      case 'connecting':
        return 'Connecting…';
      case 'listening':
        return this.voiceMuted() ? 'Muted' : 'Listening';
      case 'thinking':
        return 'Thinking…';
      case 'speaking':
        return 'Speaking';
      case 'error':
        return 'Call ended';
      default:
        return 'Press to start';
    }
  }

  protected async toggleCall() {
    if (this.voiceActive()) {
      await this.endCall();
      return;
    }

    this.voiceError.set(null);
    this.voiceNoiseFilterUnavailable.set(false);
    this.voiceLines.set([]);
    this.voicePartialIndex.clear();
    this.clearVoiceReveal();

    if (!this.live()) {
      this.voiceState.set('connecting');
      setTimeout(() => this.voiceState.set('listening'), 1500);
      return;
    }

    await this.voice.start({
      agentId: this.agentKey(),
      conversationId: this.conversationId(),
      onState: (state) => this.setVoiceState(state),
      onTranscript: (entry) => this.applyTranscript(entry),
      onConversationId: (id) => this.conversationId.set(id),
      onError: (message) => this.voiceError.set(message),
      onNoiseFilterUnavailable: () => this.voiceNoiseFilterUnavailable.set(true),
    });
  }

  protected async endCall() {
    await this.voice.stop();
    this.setVoiceState('idle');
    this.voiceMuted.set(false);
    this.voicePartialIndex.clear();
    this.clearVoiceReveal();
    this.voiceLines.set([]);
  }

  protected async toggleMute() {
    this.voiceMuted.set(!this.voiceMuted());
    await this.voice.setMuted(this.voiceMuted());
  }

  /** Sets voice state and arms/disarms the "taking a while" reassurance timer
   *  around the two states that can genuinely stall (worker join, LLM reply). */
  private setVoiceState(state: VoiceState) {
    this.voiceState.set(state);
    clearTimeout(this.voiceWaitingTimer);
    this.voiceWaitingLong.set(false);
    if (state === 'connecting' || state === 'thinking') {
      this.voiceWaitingTimer = setTimeout(() => this.voiceWaitingLong.set(true), 5000);
    }
  }

  ngOnDestroy() {
    this.endCall();
    clearTimeout(this.chatPendingTimer);
    clearTimeout(this.voiceWaitingTimer);
    this.clearVoiceReveal();
    this.vscriptObserver?.disconnect();
  }

  private applyTranscript(entry: VoiceTranscript) {
    const existingIndex = this.voicePartialIndex.get(entry.id);
    let index: number;
    if (existingIndex != null && this.voiceLines()[existingIndex]) {
      index = existingIndex;
    } else {
      index = this.voiceLines().length;
      this.voiceLines.update((list) => [...list, { role: entry.role, text: '', pending: !entry.final }]);
      this.voiceReveal.set(index, { shown: 0 });
      this.voicePartialIndex.set(entry.id, index);
    }
    if (entry.final) {
      this.voicePartialIndex.delete(entry.id);
    }
    this.revealLine(index, entry.text, !entry.final);
  }

  /** Types a line's text into place a chunk at a time. A small incremental
   *  growth (true live streaming) applies immediately; a big jump (the
   *  worker sending the whole reply in one message) animates instead, so the
   *  transcript never just pops the full answer in after a silent wait. */
  private revealLine(index: number, fullText: string, pending: boolean) {
    const state = this.voiceReveal.get(index) ?? { shown: 0 };
    this.voiceReveal.set(index, state);
    clearInterval(state.timer);
    state.timer = undefined;

    if (fullText.length - state.shown <= 24) {
      state.shown = fullText.length;
      this.setVoiceLineText(index, fullText, pending);
      this.scrollTranscript();
      return;
    }

    const chunk = Math.max(3, Math.ceil(fullText.length / 45));
    state.timer = setInterval(() => {
      state.shown = Math.min(fullText.length, state.shown + chunk);
      this.setVoiceLineText(index, fullText.slice(0, state.shown), pending || state.shown < fullText.length);
      this.scrollTranscript();
      if (state.shown >= fullText.length) {
        clearInterval(state.timer);
        state.timer = undefined;
      }
    }, 28);
  }

  private setVoiceLineText(index: number, text: string, pending: boolean) {
    this.voiceLines.update((list) => {
      if (!list[index]) return list;
      const copy = list.slice();
      copy[index] = { ...copy[index], text, pending };
      return copy;
    });
  }

  private clearVoiceReveal() {
    for (const state of this.voiceReveal.values()) clearInterval(state.timer);
    this.voiceReveal.clear();
  }

  private vscriptObserver?: MutationObserver;
  private vscriptObserved?: HTMLElement;

  /** Pins the transcript to its bottom edge. A MutationObserver — rather than
   *  a timed callback — reacts to every DOM change (each revealed character,
   *  each new line, each image finishing layout) the instant it happens, so
   *  it can't fall behind regardless of how fast lines are arriving. */
  private scrollTranscript() {
    const el = this.vscript?.nativeElement;
    if (!el) return;
    if (el !== this.vscriptObserved) {
      this.vscriptObserver?.disconnect();
      this.vscriptObserved = el;
      this.vscriptObserver = new MutationObserver(() => {
        el.scrollTop = el.scrollHeight;
        this.keepInPageView(el);
      });
      this.vscriptObserver.observe(el, { childList: true, subtree: true, characterData: true });
    }
    el.scrollTop = el.scrollHeight;
    this.keepInPageView(el);
  }

  private lastPageScrollAt = 0;

  /** As the transcript grows it can push its own bottom edge below the fold
   *  even though the panel is internally scrolled to its latest line — nudge
   *  the page itself down so the live conversation stays in view. Only acts
   *  when the edge has actually drifted off-screen, and is throttled so the
   *  character-by-character reveal doesn't restart the smooth-scroll dozens
   *  of times a second. */
  private keepInPageView(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= window.innerHeight) return;
    const now = Date.now();
    if (now - this.lastPageScrollAt < 350) return;
    this.lastPageScrollAt = now;
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  protected sendMessage(text?: string) {
    const value = (text ?? this.composerText()).trim();
    if (!value || this.chatPending()) return;
    this.chatMessages.update((list) => [...list, { role: 'user', text: value }]);
    this.composerText.set('');
    this.suggestedReplies.set([]);
    this.chatPending.set(true);
    this.beginAwaitingReply();

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
                this.endAwaitingReply();
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
              this.endAwaitingReply();
              this.chatMessages.update((list) => [...list, { role: 'agent', text: evt.error! }]);
              this.chatPending.set(false);
            } else if (evt.final) {
              this.endAwaitingReply();
              this.conversationId.set(evt.final.conversationId || this.conversationId());
              this.lastMessageId.set(evt.final.responseMessageId || this.lastMessageId());
              this.chatPending.set(false);
              this.api
                .getSuggestedReplies(this.conversationId(), value, this.agent().description)
                .then((replies) => this.suggestedReplies.set(replies));
            }
          },
          error: () => {
            this.endAwaitingReply();
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
      this.endAwaitingReply();
      this.chatPending.set(false);
      this.chatMessages.update((list) => [
        ...list,
        { role: 'agent', text: `Once ${agentName} is connected, its real answer shows up right here.` },
      ]);
    }, 1200);
  }
}
