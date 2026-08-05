import { Component, input, signal } from '@angular/core';
import { Plan, Region } from '../experience-data';

const PUBLISH_TARGETS = ['Website widget', 'Hosted subdomain', 'WhatsApp', 'App & GPT stores', 'Directory listing'];

@Component({
  selector: 'app-xz-lead',
  templateUrl: './lead.html',
})
export class XzLead {
  readonly region = input.required<Region>();
  readonly plan = input.required<Plan>();

  protected readonly name = signal('');
  protected readonly company = signal('');
  protected readonly phone = signal('');
  protected readonly email = signal('');
  protected readonly volume = signal('');
  protected readonly callError = signal('');
  protected readonly callDone = signal(false);
  protected readonly callDoneText = signal('');

  protected readonly publishTargets = PUBLISH_TARGETS;
  protected readonly picked = signal<Set<string>>(new Set());
  protected readonly subEmail = signal('');
  protected readonly subError = signal('');
  protected readonly subDone = signal(false);
  protected readonly subDoneText = signal('');

  protected togglePublish(target: string) {
    this.picked.update((set) => {
      const next = new Set(set);
      if (next.has(target)) next.delete(target);
      else next.add(target);
      return next;
    });
  }

  protected planPrice(): number | null {
    return this.plan().priceByRegion[this.region().id] ?? null;
  }

  protected submitCall(event: Event) {
    event.preventDefault();
    this.callError.set('');
    const digits = this.phone().replace(/\D/g, '');
    if (this.name().trim().length < 2) return this.callError.set('Name is required.');
    if (this.company().trim().length < 2) return this.callError.set('Company is required.');
    if (digits.length < 7) return this.callError.set('Phone number is too short.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.email())) return this.callError.set('Enter a valid email address.');

    this.callDoneText.set(
      `We'll call ${this.region().code} ${this.phone()} for ${this.name()} at ${this.company()} within one working day` +
        (this.volume() ? ` · ${this.volume().toLowerCase()} conversations/month` : '') +
        '.',
    );
    this.callDone.set(true);
  }

  protected submitSubscribe(event: Event) {
    event.preventDefault();
    this.subError.set('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(this.subEmail())) return this.subError.set('Enter a valid email address.');

    const list = [...this.picked()];
    const planName = this.plan().name;
    this.subDoneText.set(
      list.length
        ? `${planName} plan · publishing to ${
            list.length > 2 ? list.slice(0, 2).join(', ') + ' +' + (list.length - 2) : list.join(' and ')
          }. Setup link sent to ${this.subEmail()}.`
        : `${planName} plan started. Setup link sent to ${this.subEmail()}; publishing can be chosen later.`,
    );
    this.subDone.set(true);
  }
}
