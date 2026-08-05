import { Component, computed, signal } from '@angular/core';
import { CHANNELS } from '../experience-data';

interface OutcomeCount {
  resolved: number;
  ticketed: number;
  routed: number;
}

interface TeamMember {
  initials: string;
  name: string;
  role: string;
}

// Illustrative sample answer shown in the "customer view" preview — the same
// worked example across channels, reformatted the way each channel delivers it.
const SAMPLE_Q = 'Are Mum and Dad covered on my health plan?';
const SAMPLE_A =
  "Yes — both parents are covered. They sit on your ₹10L family floater as a dependent parent rider, added at the 2024 renewal. Two things worth knowing: the room rent is capped at ₹5,000/day, and the floater is shared, so one large claim reduces what's left for everyone else this year.";
const SAMPLE_CITE = 'Health_Policy_2024.pdf';

// Illustrative support roster — greyed out as the containment slider (below,
// in the business case) implies fewer people are needed to staff the queue.
const TEAM: TeamMember[] = [
  { initials: 'SA', name: 'Sarah', role: 'Escalations' },
  { initials: 'LI', name: 'Liam', role: 'Tier 1' },
  { initials: 'EM', name: 'Emily', role: 'Tier 1' },
  { initials: 'JA', name: 'James', role: 'Overflow' },
];

@Component({
  selector: 'app-xz-value-map',
  templateUrl: './value-map.html',
})
export class XzValueMap {
  protected readonly channels = CHANNELS;
  protected readonly activeChannel = signal('chat');
  protected readonly running = signal(false);
  protected readonly ran = signal(false);
  protected readonly counts = signal<OutcomeCount>({ resolved: 0, ticketed: 0, routed: 0 });
  protected readonly containRate = 65;

  protected readonly sampleQ = SAMPLE_Q;
  protected readonly sampleA = SAMPLE_A;
  protected readonly sampleCite = SAMPLE_CITE;

  protected readonly team = computed(() => {
    const keep = Math.max(1, Math.ceil(TEAM.length * (1 - this.containRate / 100)));
    return TEAM.map((person, i) => ({ ...person, off: i >= keep }));
  });

  protected selectChannel(id: string) {
    this.activeChannel.set(id);
  }

  protected runSimulation() {
    if (this.running()) return;
    this.running.set(true);
    const target: OutcomeCount = {
      resolved: Math.round(this.containRate),
      ticketed: Math.round((100 - this.containRate) * 0.6),
      routed: 0,
    };
    target.routed = 100 - target.resolved - target.ticketed;

    let step = 0;
    const steps = 24;
    const timer = setInterval(() => {
      step++;
      const f = Math.min(1, step / steps);
      this.counts.set({
        resolved: Math.round(target.resolved * f),
        ticketed: Math.round(target.ticketed * f),
        routed: Math.round(target.routed * f),
      });
      if (f >= 1) {
        clearInterval(timer);
        this.running.set(false);
        this.ran.set(true);
      }
    }, 55);
  }
}
