import { Injectable, inject } from '@angular/core';
import {
  LocalAudioTrack,
  LocalTrackPublication,
  Participant,
  RemoteAudioTrack,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  TranscriptionSegment,
} from 'livekit-client';
import { LibrechatApi } from './librechat-api';
import { LIBRECHAT_TENANT_ID } from './librechat-config';
import { AuthSession } from './auth-session';
import {
  LIVEKIT_AGENT_NAME,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  LIVEKIT_NOISE_FILTER,
  LIVEKIT_URL,
} from './livekit-config';

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface VoiceTranscript {
  /** LiveKit's own segment id — lets the caller collapse repeated updates to
   *  the same utterance into one line instead of appending a new one. */
  id: string;
  role: 'user' | 'agent';
  text: string;
  final: boolean;
}

export interface VoiceSessionOptions {
  agentId: string;
  conversationId?: string | null;
  onState: (state: VoiceState) => void;
  onTranscript: (entry: VoiceTranscript) => void;
  onConversationId?: (conversationId: string) => void;
  onError: (message: string) => void;
  /** Fires when the background-voice/noise filter couldn't be enabled — the
   *  call still proceeds on the raw mic, just without that extra filtering. */
  onNoiseFilterUnavailable?: () => void;
  onInputLevel?: (level: number) => void;
}

interface AgentDataMessage {
  type?: string;
  role?: 'user' | 'agent';
  text?: string;
  final?: boolean;
  state?: VoiceState;
  conversationId?: string;
}

const LOG_PREFIX = '[voice]';
const INPUT_LEVEL_INTERVAL_MS = 50;
const INPUT_LEVEL_GAIN = 6;
const INPUT_LEVEL_LOG_MS = 2000;

@Injectable({ providedIn: 'root' })
export class LivekitVoice {
  private readonly api = inject(LibrechatApi);
  private readonly session = inject(AuthSession);

  private room: Room | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private options: VoiceSessionOptions | null = null;
  private stopping = false;
  private levelContext: AudioContext | null = null;
  private levelFrame: number | null = null;
  private levelEmittedAt = 0;
  private levelPeak = 0;
  private levelLoggedAt = 0;

  get isActive(): boolean {
    return this.room != null;
  }

  isConfigured(): boolean {
    return LIVEKIT_URL.trim().length > 0 && LIVEKIT_API_KEY.trim().length > 0 && LIVEKIT_API_SECRET.trim().length > 0;
  }

  private log(message: string, detail?: unknown): void {
    if (detail === undefined) {
      console.log(`${LOG_PREFIX} ${message}`);
    } else {
      console.log(`${LOG_PREFIX} ${message}`, detail);
    }
  }

  private logError(message: string, detail?: unknown): void {
    console.error(`${LOG_PREFIX} ${message}`, detail ?? '');
  }

  async start(options: VoiceSessionOptions): Promise<void> {
    if (this.room) {
      await this.stop();
    }
    this.options = options;
    this.stopping = false;
    options.onState('connecting');

    try {
      await this.session.whenAgentReady();
      const identity = this.api.userId();
      const roomName = this.roomName(options.agentId, identity);
      this.log('starting call', {
        room: roomName,
        identity,
        agentId: options.agentId,
        tenantId: LIBRECHAT_TENANT_ID,
        conversationId: options.conversationId ?? null,
        url: LIVEKIT_URL,
      });

      const token = await this.mintToken(roomName, identity, {
        agentId: options.agentId,
        conversationId: options.conversationId ?? '',
        tenantId: LIBRECHAT_TENANT_ID,
        gosureUserId: identity,
        gosureToken: this.session.agentToken(),
      });
      this.log('token minted', { length: token.length });

      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;
      this.wireRoomEvents(room);

      await room.connect(LIVEKIT_URL, token);
      this.log('room connected', {
        room: room.name,
        localParticipant: room.localParticipant.identity,
        remoteParticipants: room.remoteParticipants.size,
      });
      if (room.remoteParticipants.size === 0) {
        this.log('no agent in room yet — waiting for the worker to join');
      }

      const micPublication = await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      this.log('microphone published');
      this.startInputMeter(micPublication);
      await this.enableAudioPlayback(room);
      options.onState('listening');

      // Not awaited: Krisp is ~2 MB over the wire, which is nothing from the
      // dev server but several seconds from the deployed site — long enough,
      // on the first call of a visit, to hold the call on "Connecting…" while
      // the agent is already in the room talking. The raw mic is published and
      // audible to the agent the whole time; the filter swaps in when it lands.
      void this.applyNoiseFilter(micPublication).then(() => {
        if (this.room !== room) return;
        this.stopInputMeter();
        this.startInputMeter(micPublication);
      });
    } catch (err: unknown) {
      this.logError('start failed', err);
      this.options?.onError(this.describeError(err));
      this.options?.onState('error');
      await this.stop();
    }
  }

  async stop(): Promise<void> {
    const room = this.room;
    if (room) {
      this.log('stopping call (local)');
    }
    this.stopping = true;
    this.room = null;
    this.stopInputMeter();
    this.options?.onInputLevel?.(0);
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }
    if (room) {
      try {
        await room.disconnect();
      } catch {
        /* already gone */
      }
    }
    this.options?.onState('idle');
    this.options = null;
  }

  async setMuted(muted: boolean): Promise<void> {
    if (!this.room) return;
    await this.room.localParticipant.setMicrophoneEnabled(!muted);
  }

  private wireRoomEvents(room: Room): void {
    room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      this.log('track subscribed', { kind: track.kind, sid: track.sid });
      if (track.kind !== Track.Kind.Audio) return;
      this.attachAgentAudio(track as RemoteAudioTrack);
      this.log('agent audio attached');
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      this.log('participant joined', { identity: participant.identity });
    });

    room.on(RoomEvent.LocalTrackSubscribed, (publication) => {
      this.log('the agent subscribed to our track', { kind: publication.kind, sid: publication.trackSid });
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      this.log('participant left', { identity: participant.identity });
      if (!this.stopping) {
        this.options?.onError('The voice agent left the call. Is the worker running?');
        this.options?.onState('error');
      }
    });

    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      this.handleDataMessage(payload);
    });

    // LiveKit's native STT/TTS transcription channel — this is how most
    // agent workers (including the livekit-agents framework) actually
    // deliver spoken text, separate from the ad-hoc DataReceived messages
    // above (which this worker uses only for state/conversation-id).
    room.on(RoomEvent.TranscriptionReceived, (segments: TranscriptionSegment[], participant?: Participant) => {
      const role: 'user' | 'agent' = participant?.isLocal ? 'user' : 'agent';
      for (const segment of segments) {
        this.log('transcription segment', { id: segment.id, role, text: segment.text, final: segment.final });
        this.options?.onTranscript({ id: segment.id, role, text: segment.text, final: segment.final });
      }
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      this.log('room disconnected', { reason, localStop: this.stopping });
      this.room = null;
      if (this.stopping) {
        this.options?.onState('idle');
      } else {
        this.options?.onError('The voice call dropped. Check that the worker is running.');
        this.options?.onState('error');
      }
    });

    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      this.log('audio playback status changed', { canPlaybackAudio: room.canPlaybackAudio });
      if (!room.canPlaybackAudio) {
        this.options?.onError('Sound is blocked. Tap the call button to enable it.');
      }
    });

    room.on(RoomEvent.ConnectionStateChanged, (state) => {
      this.log('connection state', state);
    });
  }

  /** Runs Krisp's ML noise filter on the mic track, with background-voice
   *  cancellation on — this is what actually stops a second person talking
   *  nearby (or a TV, or murmuring) from being picked up as if it were the
   *  caller, which the browser's own noiseSuppression constraint doesn't do.
   *  Krisp ships several MB of model weights, so it's loaded on demand here
   *  rather than bundled into the page everyone downloads up front. */
  private async applyNoiseFilter(publication: LocalTrackPublication | undefined): Promise<void> {
    const track = publication?.track;
    if (!track || !(track instanceof LocalAudioTrack)) return;
    if (!LIVEKIT_NOISE_FILTER) {
      this.log('Krisp noise filter disabled in livekit-config.ts — using the raw mic');
      return;
    }
    try {
      const { isKrispNoiseFilterSupported, KrispNoiseFilter } = await import('@livekit/krisp-noise-filter');
      if (!isKrispNoiseFilterSupported()) {
        this.log('Krisp noise filter not supported on this browser/device — using raw mic constraints only');
        this.options?.onNoiseFilterUnavailable?.();
        return;
      }
      // 'high' quality was pegging the CPU badly enough to make the whole
      // page hang during a call; 'medium' is Krisp's own recommended default.
      await track.setProcessor(KrispNoiseFilter({ useBVC: true, quality: 'medium' }));
      this.log('Krisp noise + background-voice filter enabled');
    } catch (err) {
      this.logError('failed to enable Krisp noise filter', err);
      this.options?.onNoiseFilterUnavailable?.();
    }
  }

  private startInputMeter(publication: LocalTrackPublication | undefined): void {
    const track = publication?.track;
    if (!track || !(track instanceof LocalAudioTrack)) return;
    const mediaTrack = track.getProcessor()?.processedTrack ?? track.mediaStreamTrack;
    if (!mediaTrack) return;
    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;
      context.createMediaStreamSource(new MediaStream([mediaTrack])).connect(analyser);
      if (context.state === 'suspended') void context.resume();
      this.levelContext = context;

      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        this.levelFrame = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - this.levelEmittedAt < INPUT_LEVEL_INTERVAL_MS) return;
        this.levelEmittedAt = now;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) sum += sample * sample;
        const rms = Math.sqrt(sum / samples.length);
        this.options?.onInputLevel?.(Math.min(1, rms * INPUT_LEVEL_GAIN));

        if (rms > this.levelPeak) this.levelPeak = rms;
        if (now - this.levelLoggedAt >= INPUT_LEVEL_LOG_MS) {
          this.levelLoggedAt = now;
          this.log('mic level over the last 2s', {
            peak: Number(this.levelPeak.toFixed(4)),
            processed: track.getProcessor() != null,
          });
          this.levelPeak = 0;
        }
      };
      this.levelLoggedAt = performance.now();
      this.levelFrame = requestAnimationFrame(tick);
      this.log('input level meter running', { processed: track.getProcessor() != null });
    } catch (err) {
      this.logError('failed to start the input level meter', err);
    }
  }

  private stopInputMeter(): void {
    if (this.levelFrame != null) {
      cancelAnimationFrame(this.levelFrame);
      this.levelFrame = null;
    }
    if (this.levelContext) {
      void this.levelContext.close().catch(() => undefined);
      this.levelContext = null;
    }
    this.levelEmittedAt = 0;
    this.levelPeak = 0;
    this.levelLoggedAt = 0;
  }

  private attachAgentAudio(track: RemoteAudioTrack): void {
    if (!this.audioEl) {
      this.audioEl = document.createElement('audio');
      this.audioEl.autoplay = true;
      this.audioEl.style.display = 'none';
      document.body.appendChild(this.audioEl);
    }
    track.attach(this.audioEl);
  }

  private async enableAudioPlayback(room: Room): Promise<void> {
    if (room.canPlaybackAudio) {
      this.log('audio playback already permitted');
      return;
    }
    try {
      await room.startAudio();
      this.log('audio playback unlocked');
    } catch (err) {
      this.logError('audio playback blocked by the browser', err);
      this.options?.onError('Sound is blocked. Tap the call button to enable it.');
    }
  }

  private handleDataMessage(payload: Uint8Array): void {
    let msg: AgentDataMessage;
    try {
      msg = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      this.logError('unparseable data message');
      return;
    }
    this.log('data from worker', msg);
    if (!this.options) return;

    if (msg.type === 'state' && msg.state) {
      this.options.onState(msg.state);
      return;
    }
    if (msg.type === 'conversation' && msg.conversationId) {
      this.options.onConversationId?.(msg.conversationId);
      return;
    }
    // Deliberately no 'transcript' handling here. The worker sends every line
    // on both channels: this one, and RoomEvent.TranscriptionReceived (see
    // wireRoomEvents) via its TranscriptSynchronizer. Handling both duplicates
    // every agent line on screen, so the synchronised channel is the only one
    // read — its text is paced to the audio, this one runs ahead of it.
    if (msg.type === 'error') {
      this.options.onError(msg.text || 'The voice agent hit an error.');
      this.options.onState('error');
    }
  }

  /**
   * Browser-side token signing. Swap this one method for a call to a server
   * endpoint before deploying — see the note in livekit-config.ts.
   */
  private async mintToken(
    room: string,
    identity: string,
    metadata: Record<string, string>,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('LiveKit credentials are not set in livekit-config.ts.');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const agentName = LIVEKIT_AGENT_NAME.trim();
    const claims = {
      iss: LIVEKIT_API_KEY,
      sub: identity,
      name: identity,
      nbf: now - 10,
      exp: now + 60 * 60,
      metadata: JSON.stringify(metadata),
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      ...(agentName
        ? { roomConfig: { agents: [{ agentName, metadata: JSON.stringify(metadata) }] } }
        : {}),
    };
    if (agentName) this.log('requesting explicit agent dispatch', { agentName });

    const signingInput = `${this.base64Url(JSON.stringify(header))}.${this.base64Url(
      JSON.stringify(claims),
    )}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(LIVEKIT_API_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
    return `${signingInput}.${this.base64UrlBytes(new Uint8Array(signature))}`;
  }

  private base64Url(value: string): string {
    return this.base64UrlBytes(new TextEncoder().encode(value));
  }

  private base64UrlBytes(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Unique per call. A deterministic name lets a room outlive the worker that
   * served it, and LiveKit will not dispatch a second agent into a room it has
   * already dispatched for — leaving the caller alone in it forever.
   */
  private roomName(agentId: string, identity: string): string {
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const base = `aidouble-${LIBRECHAT_TENANT_ID}-${identity}-${agentId}`.slice(0, 100);
    return `${base}-${nonce}`;
  }

  private describeError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (/permission|NotAllowedError/i.test(message)) {
      return 'Microphone access was blocked. Allow it in the browser and try again.';
    }
    if (/credentials are not set/i.test(message)) {
      return message;
    }
    return `Could not start voice mode: ${message}`;
  }
}
