import { Injectable } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { LIBRECHAT_BASE_URL, LIBRECHAT_DEMO_TOKEN, LIBRECHAT_TENANT_ID } from './librechat-config';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';
const VISITOR_ID_KEY = 'aidouble_try_visitor_id';

// conversation_starters entries are stored as "icon::text" (e.g.
// "pi-bolt::Health Insurance"); one reserved entry with this prefix encodes
// the agent's own icon rather than a real prompt. Mirrors cokube's
// src/app/components/libre-chat/quick-prompts.ts.
const ICON_STARTER_PREFIX = '__agenticon__::';

/** Strips the icon prefix from real starters and drops the icon sentinel. */
export function parseConversationStarters(raw: string[] | undefined): string[] {
  return (raw ?? [])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0 && !s.startsWith(ICON_STARTER_PREFIX))
    .map((s) => {
      const idx = s.indexOf('::');
      return (idx > -1 ? s.slice(idx + 2) : s).trim();
    })
    .filter(Boolean);
}

export interface LibrechatAgent {
  id: string;
  name: string | null;
  description: string | null;
  conversation_starters?: string[];
}

interface AgentListResponse {
  data: LibrechatAgent[];
}

export interface AgentSendOptions {
  text: string;
  agentId: string;
  conversationId?: string | null;
  parentMessageId?: string | null;
}

export interface AgentStreamEvent {
  textDelta?: string;
  final?: { conversationId: string; responseMessageId: string; fullText: string };
  error?: string;
}

interface StartJobResponse {
  streamId: string;
}

@Injectable({ providedIn: 'root' })
export class LibrechatApi {
  private readonly baseUrl = LIBRECHAT_BASE_URL;

  /** Whether a token has been configured — callers should fall back when false. */
  isConfigured(): boolean {
    return LIBRECHAT_DEMO_TOKEN.trim().length > 0;
  }

  /** Context-aware follow-up chips shown after an agent reply. Never throws —
   *  resolves to [] on any failure so it's safe to call without a catch. */
  async getSuggestedReplies(
    conversationId: string | null,
    lastUserMessage: string,
    agentDescription: string | null,
  ): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/agents/suggest-replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.identityHeaders() },
        body: JSON.stringify({ conversationId, lastUserMessage, agentDescription }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { replies?: string[] };
      return Array.isArray(data?.replies) ? data.replies : [];
    } catch {
      return [];
    }
  }

  /** The list endpoint omits conversation_starters — only the per-agent
   *  detail endpoint has them, so the agent list is fetched separately from
   *  each agent's starter prompts (see Try.loadAgentDetail, called lazily
   *  per selection rather than for all agents up front). */
  async listAgents(): Promise<LibrechatAgent[]> {
    const res = await fetch(`${this.baseUrl}/api/agents/`, {
      headers: { 'Content-Type': 'application/json', ...this.identityHeaders() },
    });
    if (!res.ok) {
      throw new Error(`GET /api/agents/ ${res.status}: ${await res.text().catch(() => '')}`);
    }
    const body = (await res.json()) as AgentListResponse;
    return Array.isArray(body?.data) ? body.data : [];
  }

  async getAgent(agentId: string): Promise<LibrechatAgent> {
    const res = await fetch(`${this.baseUrl}/api/agents/${agentId}`, {
      headers: { 'Content-Type': 'application/json', ...this.identityHeaders() },
    });
    if (!res.ok) {
      throw new Error(`GET /api/agents/${agentId} ${res.status}: ${await res.text().catch(() => '')}`);
    }
    return (await res.json()) as LibrechatAgent;
  }

  sendAgentMessage(opts: AgentSendOptions): Observable<AgentStreamEvent> {
    return new Observable<AgentStreamEvent>((subscriber) => {
      let cancelled = false;
      let abortController: AbortController | null = null;

      const run = async () => {
        try {
          const body = {
            endpoint: 'agents',
            agent_id: opts.agentId,
            text: opts.text,
            messageId: this.randomUuid(),
            parentMessageId: opts.parentMessageId ?? ZERO_UUID,
            conversationId: opts.conversationId ?? null,
            isContinued: false,
          };

          const startRes = await fetch(`${this.baseUrl}/api/agents/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...this.identityHeaders() },
            body: JSON.stringify(body),
          });
          if (!startRes.ok) {
            throw new Error(`POST /api/agents/chat ${startRes.status}: ${await startRes.text().catch(() => '')}`);
          }
          const start = (await startRes.json()) as StartJobResponse;
          if (cancelled) return;

          abortController = new AbortController();
          const streamRes = await fetch(`${this.baseUrl}/api/agents/chat/stream/${start.streamId}`, {
            headers: { Accept: 'text/event-stream', ...this.identityHeaders() },
            signal: abortController.signal,
          });
          if (!streamRes.ok || !streamRes.body) {
            throw new Error(`GET stream ${streamRes.status}: ${await streamRes.text().catch(() => '')}`);
          }

          await this.consumeSse(streamRes.body, subscriber);
          subscriber.complete();
        } catch (err: unknown) {
          if (cancelled) return;
          subscriber.error(err);
        }
      };

      run();

      return () => {
        cancelled = true;
        abortController?.abort();
      };
    });
  }

  private identityHeaders(): Record<string, string> {
    return {
      'X-Tenant-Id': LIBRECHAT_TENANT_ID,
      'X-User-Id': this.userId(),
      ...(LIBRECHAT_DEMO_TOKEN ? { 'X-Gosure-Token': LIBRECHAT_DEMO_TOKEN } : {}),
    };
  }

  /** The real GoSure user behind the configured token (decoded client-side —
   *  JWT payloads aren't encrypted, just base64url). Falls back to a stable
   *  per-browser anonymous id if there's no token or it can't be parsed. */
  private userId(): string {
    const claims = this.decodeJwt(LIBRECHAT_DEMO_TOKEN);
    const raw = claims?.['userId'] ?? claims?.['sub'];
    return typeof raw === 'string' && raw ? this.toHeaderSafeUserId(raw) : this.visitorId();
  }

  private decodeJwt(token: string): Record<string, unknown> | null {
    const payload = token.split('.')[1];
    if (!payload) return null;
    try {
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  }

  // Mirrors cokube's sanitizer — the backend 403s on X-User-Id outside [-a-zA-Z0-9_.].
  private toHeaderSafeUserId(raw: string): string {
    return raw.trim().replace(/@/g, '_at_').replace(/[^-a-zA-Z0-9_.]/g, '_').slice(0, 128);
  }

  /** Stable-per-browser anonymous id so a visitor's demo conversation has continuity. */
  private visitorId(): string {
    if (typeof window === 'undefined' || !window.localStorage) return 'aidouble_visitor';
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      id = `aidouble_${this.randomUuid().replace(/-/g, '').slice(0, 20)}`;
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  }

  private randomUuid(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private async consumeSse(body: ReadableStream<Uint8Array>, subscriber: Observer<AgentStreamEvent>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex: number;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(json);
        } catch {
          continue;
        }

        const result = this.interpretEvent(parsed, accumulatedText);
        accumulatedText = result.newAccumulated;
        for (const evt of result.events) {
          subscriber.next(evt);
          if (evt.final || evt.error) return;
        }
      }
    }
  }

  /** Simplified port of cokube's interpretEvent — handles the text-delta and
   *  final-response shapes; tool-call progress events aren't surfaced here. */
  private interpretEvent(
    data: Record<string, unknown>,
    accumulatedText: string,
  ): { events: AgentStreamEvent[]; newAccumulated: string } {
    if (data['final'] === true || data['final'] != null) {
      const response = (data['responseMessage'] ?? (data['final'] as Record<string, unknown>)?.['responseMessage'] ?? {}) as Record<string, unknown>;
      const contentError = this.extractContentError(response);
      if (contentError) {
        return { events: [{ error: contentError }], newAccumulated: accumulatedText };
      }
      const conversation = data['conversation'] as Record<string, unknown> | undefined;
      return {
        events: [
          {
            final: {
              conversationId: String(conversation?.['conversationId'] ?? data['conversationId'] ?? response['conversationId'] ?? ''),
              responseMessageId: String(response['messageId'] ?? data['messageId'] ?? ''),
              fullText: String(response['text'] ?? accumulatedText),
            },
          },
        ],
        newAccumulated: accumulatedText,
      };
    }

    let delta = '';
    if (data['type'] === 'text' && typeof data['text'] === 'string' && data['index'] != null) {
      const text = data['text'] as string;
      delta = text.startsWith(accumulatedText) ? text.slice(accumulatedText.length) : text;
    } else {
      const deltaContent = (data['data'] as Record<string, unknown> | undefined)?.['delta'] as Record<string, unknown> | undefined;
      const contentArr = deltaContent?.['content'];
      if (data['event'] === 'on_message_delta' && Array.isArray(contentArr)) {
        for (const part of contentArr as Record<string, unknown>[]) {
          if (part?.['type'] === 'text' && typeof part['text'] === 'string') {
            delta += part['text'] as string;
          }
        }
      } else if (typeof data['text'] === 'string') {
        const text = data['text'] as string;
        delta = text.startsWith(accumulatedText) ? text.slice(accumulatedText.length) : text;
      } else if (typeof data['response'] === 'string') {
        const text = data['response'] as string;
        delta = text.startsWith(accumulatedText) ? text.slice(accumulatedText.length) : text;
      }
    }

    const newAccumulated = delta ? accumulatedText + delta : accumulatedText;
    const events: AgentStreamEvent[] = delta ? [{ textDelta: delta }] : [];
    return { events, newAccumulated };
  }

  private extractContentError(response: Record<string, unknown>): string | null {
    const content = response['content'];
    if (!Array.isArray(content)) return null;
    for (const part of content as Record<string, unknown>[]) {
      if (part?.['type'] === 'error' && typeof part['error'] === 'string' && (part['error'] as string).trim()) {
        return this.friendlyAgentError(part['error'] as string);
      }
    }
    return null;
  }

  private friendlyAgentError(raw: string): string {
    const text = raw.toLowerCase();
    if (text.includes('quota') || text.includes('insufficient_quota')) {
      return 'This agent is temporarily unavailable — the AI provider account is out of quota.';
    }
    if (text.includes('429') || text.includes('rate limit')) {
      return 'Getting a lot of requests right now — please try again in a moment.';
    }
    if (text.includes('401') || text.includes('invalid api key')) {
      return 'This agent is misconfigured. Please try again later.';
    }
    const firstLine = raw.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
    return firstLine ?? 'The agent could not process this request. Please try again.';
  }
}
