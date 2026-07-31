import { Component, computed, signal } from '@angular/core';
import { Reveal } from '../reveal';

export type UseCaseKey = 'insurance' | 'money' | 'home' | 'health' | 'family';

export interface UseCase {
  key: UseCaseKey;
  label: string;
  heading: string;
  points: string[];
}

const USE_CASES: UseCase[] = [
  {
    key: 'insurance',
    label: 'Insurance',
    heading: 'Insurance, sorted before renewal',
    points: [
      'Catches renewals before they auto-debit',
      'Compares your premium to the going rate',
      'Reads your policy and explains what you actually hold',
      'Hands you a verified advisor to negotiate',
    ],
  },
  {
    key: 'money',
    label: 'Money & tax',
    heading: 'Tax and money, on time',
    points: [
      'Tracks filing deadlines and gathers documents',
      'Remembers your regime, loans and SIPs',
      'Explains what a form or notice actually means',
      'Connects you to a verified CA when it matters',
    ],
  },
  {
    key: 'home',
    label: 'Home & bills',
    heading: 'The household paperwork, handled',
    points: [
      'Watches every bill due date and dispute',
      'Keeps your rent, registry and utilities in order',
      'Finds the repair contact you saved months ago',
      'Flags anything that needs your decision',
    ],
  },
  {
    key: 'health',
    label: 'Health',
    heading: 'Health admin, kept private',
    points: [
      'Remembers appointments, records and cover',
      'Tells you what your policy includes',
      'Kept separate from the rest of your data',
      'Second opinions from verified professionals',
    ],
  },
  {
    key: 'family',
    label: 'Family',
    heading: 'One Double for the whole family',
    points: [
      "Tracks your parents' renewals and school fees",
      'Separate private space for each member',
      'Shared view of bills and policies',
      'Elder-care mode for aging parents',
    ],
  },
];

@Component({
  selector: 'app-use-cases',
  imports: [Reveal],
  templateUrl: './use-cases.html',
})
export class UseCases {
  protected readonly useCases = USE_CASES;
  protected readonly activeKey = signal<UseCaseKey>('insurance');
  protected readonly active = computed(
    () => this.useCases.find((useCase) => useCase.key === this.activeKey())!,
  );

  protected select(key: UseCaseKey) {
    this.activeKey.set(key);
  }
}
