import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { marked } from 'marked';
import { Reveal } from '../reveal';
import { LibrechatApi, parseConversationStarters } from './librechat-api';

export type TryMode = 'voice' | 'chat';

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
}

// Shown until the real agent list loads (or if it can't — see ngOnInit).
const FALLBACK_AGENTS: AgentOption[] = [
  {
    key: 'insurance',
    label: 'Insurance renewal',
    line: 'Am I overpaying on my car renewal?',
    description: null,
    prompts: [
      'Am I overpaying on my car renewal?',
      'Compare my premium to the going rate',
      'Explain what my policy actually covers',
      'Connect me to a verified advisor',
    ],
  },
  {
    key: 'money',
    label: 'Tax filing',
    line: "When's my filing due, and what's left?",
    description: null,
    prompts: [
      "When's my filing due, and what's left?",
      'Which documents am I still missing?',
      'Explain this notice in plain English',
      'Remind me about my SIPs and loans',
    ],
  },
  {
    key: 'home',
    label: 'A bill due',
    line: 'Which bill is due this week?',
    description: null,
    prompts: [
      'Which bill is due this week?',
      'Any disputes I should know about?',
      'Find the repair contact I saved',
      'Summarize this month’s utilities',
    ],
  },
  {
    key: 'health',
    label: 'Health cover',
    line: 'What does my cover actually include?',
    description: null,
    prompts: [
      'What does my cover actually include?',
      'Remind me of my next appointment',
      'Get a second opinion from a professional',
      'Keep this separate from my other data',
    ],
  },
  {
    key: 'family',
    label: "A parent's policy",
    line: "When do Dad's policies renew?",
    description: null,
    prompts: [
      "When do Dad's policies renew?",
      'Show shared bills across the family',
      'Switch to elder-care mode',
      'Who has access to this space?',
    ],
  },
];

const GENERIC_PROMPT = 'Ask me anything.';
const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil'];
const DIAL_CODES = ['+91', '+1', '+44', '+61', '+971'];

@Component({
  selector: 'app-try',
  imports: [Reveal],
  templateUrl: './try.html',
})
export class Try implements OnInit {
  private readonly api = inject(LibrechatApi);

  protected readonly agents = signal<AgentOption[]>(FALLBACK_AGENTS);
  protected readonly languages = LANGUAGES;
  protected readonly dialCodes = DIAL_CODES;

  /** True once a real agent list has loaded — gates whether we call the live
   *  API or fall back to the local simulated demo. */
  protected readonly live = signal(false);

  protected readonly mode = signal<TryMode>('voice');
  protected readonly agentKey = signal<string>(FALLBACK_AGENTS[0].key);
  protected readonly language = signal(LANGUAGES[0]);

  protected readonly agent = computed(
    () => this.agents().find((item) => item.key === this.agentKey()) ?? this.agents()[0],
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

  protected readonly dialCode = signal(DIAL_CODES[0]);
  protected readonly phone = signal('');
  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly requested = signal(false);

  // Agent keys whose full detail (real conversation_starters) has already
  // been fetched — the list endpoint doesn't include them, so they're loaded
  // lazily per selection instead of for all 15 agents up front.
  private readonly detailedAgentKeys = new Set<string>();

  ngOnInit() {
    if (!this.api.isConfigured()) return; // no token yet — stay on the simulated demo
    this.api
      .listAgents()
      .then((list) => {
        if (!list.length) return;
        const mapped = list.map((a): AgentOption => {
          const description = a.description?.trim() || null;
          return {
            key: a.id,
            label: a.name?.trim() || 'Untitled agent',
            line: description ?? GENERIC_PROMPT,
            description,
            prompts: [description ?? GENERIC_PROMPT],
          };
        });
        this.agents.set(mapped);
        this.agentKey.set(mapped[0].key);
        this.live.set(true);
        this.loadAgentDetail(mapped[0].key);
      })
      .catch((err) => {
        // Expected until a real token is configured — fall back silently.
        console.warn('[try] live agent list unavailable, using simulated demo:', err);
      });
  }

  /** Fetches an agent's full detail for its real conversation_starters
   *  (icon-prefixed, e.g. "pi-bolt::Health Insurance") and updates it in
   *  place. Cached per key so re-selecting an agent doesn't re-fetch. */
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
      .catch((err) => {
        console.warn(`[try] could not load starter prompts for agent ${key}:`, err);
      });
  }

  protected selectMode(mode: TryMode) {
    this.mode.set(mode);
    this.calling.set(false);
    this.connected.set(false);
  }

  protected selectAgent(key: string) {
    this.agentKey.set(key);
    this.loadAgentDetail(key);
    this.calling.set(false);
    this.connected.set(false);
    this.chatMessages.set([]);
    this.chatPending.set(false);
    this.composerText.set('');
    this.suggestedReplies.set([]);
    this.conversationId.set(null);
    this.lastMessageId.set(null);
  }

  /** Renders an agent reply's markdown to sanitized HTML for [innerHTML] —
   *  Angular's binding sanitizer strips anything unsafe automatically. */
  protected renderMarkdown(text: string): string {
    return marked.parse(text, { async: false, breaks: true });
  }

  protected hubLabel() {
    if (this.connected()) return 'Live now';
    if (this.calling()) return 'Connecting…';
    return 'Start the call';
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

    // Simulated fallback — LibreChat/LiveKit not wired in yet.
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
              // Non-blocking: context-aware follow-up chips for the next turn.
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

    // Simulated fallback — LibreChat not wired in yet.
    const agentName = this.agent().label;
    setTimeout(() => {
      this.chatPending.set(false);
      this.chatMessages.update((list) => [
        ...list,
        { role: 'agent', text: `Once LibreChat is wired in, ${agentName}'s real answer shows up right here.` },
      ]);
    }, 1200);
  }

  protected requestCall(event: Event) {
    event.preventDefault();
    if (this.phone().trim().length < 7) return;
    // Integration point: trigger the outbound LiveKit call to this number,
    // with the selected LibreChat agent driving the conversation.
    this.requested.set(true);
  }
}
