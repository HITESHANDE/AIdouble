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
