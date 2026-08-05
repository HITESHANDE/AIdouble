import { Component, computed, effect, input, signal } from '@angular/core';
import { Plan, Region } from '../experience-data';

@Component({
  selector: 'app-xz-roi',
  templateUrl: './roi.html',
})
export class XzRoi {
  protected readonly Math = Math;
  readonly region = input.required<Region>();
  readonly plan = input.required<Plan>();

  protected readonly convs = signal(1200);
  protected readonly aht = signal(4);
  protected readonly contain = signal(65);
  protected readonly cost = signal(9);

  constructor() {
    effect(() => this.cost.set(this.region().costPerMin));
  }

  protected readonly contained = computed(() => Math.round((this.convs() * this.contain()) / 100));
  protected readonly minutes = computed(() => this.contained() * this.aht());
  protected readonly humanCost = computed(() => this.minutes() * this.cost());
  protected readonly platformCost = computed(() => this.planCost());
  protected readonly netSaving = computed(() => this.humanCost() - this.platformCost());
  protected readonly perConvo = computed(() => this.platformCost() / Math.max(1, this.contained()));

  private planCost(): number {
    const p = this.plan();
    const price = p.priceByRegion[this.region().id];
    const overage = p.overageByRegion[this.region().id];
    if (price === null) return this.contained() * overage;
    return price + Math.max(0, this.contained() - p.conversations) * overage;
  }

  protected money(n: number, decimals = 0): string {
    return `${this.region().currencySymbol}${n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}`;
  }

  protected num(n: number): string {
    return n.toLocaleString();
  }
}
