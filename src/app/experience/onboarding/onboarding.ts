import { Component, input, output, signal } from '@angular/core';
import { PLANS, Plan, Region } from '../experience-data';

const STEPS = [
  ['01', 'Subscribe', 'Pick a plan; card only after the trial'],
  ['02', 'Load knowledge', 'Upload the checklist for your industry'],
  ['03', 'Brand it', 'Your name, colour and voice'],
  ['04', 'Publish', 'Widget, subdomain, stores or directory'],
];

@Component({
  selector: 'app-xz-onboarding',
  templateUrl: './onboarding.html',
})
export class XzOnboarding {
  protected readonly plans = PLANS;
  protected readonly steps = STEPS;
  readonly region = input.required<Region>();
  readonly planSelected = output<Plan>();

  protected readonly selectedPlan = signal<Plan>(PLANS[1]);

  protected select(plan: Plan) {
    this.selectedPlan.set(plan);
    this.planSelected.emit(plan);
  }

  protected price(plan: Plan): number | null {
    return plan.priceByRegion[this.region().id] ?? null;
  }

  protected overage(plan: Plan): number {
    return plan.overageByRegion[this.region().id];
  }
}
