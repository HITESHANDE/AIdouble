import { Component, ElementRef, HostListener, inject, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthFlow, BusinessCreated } from '../auth-flow';
import { InstanceData } from '../../signup/signup-api';
import { Idp } from '../idps-api';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const ALL_DAYS = [...WEEKDAYS, 'Saturday', 'Sunday'];

const AVAILABILITY_DAYS: Record<string, string[]> = {
  '24/7': ALL_DAYS,
  'Business hours': WEEKDAYS,
  'Weekdays only': WEEKDAYS,
  Custom: ALL_DAYS,
};

const filledName = (control: AbstractControl) =>
  String(control.value ?? '').trim().length > 1 ? null : { filledName: true };

const chosen = (control: AbstractControl) =>
  String(control.value ?? '') !== '' ? null : { chosen: true };

@Component({
  selector: 'app-xz-auth-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-modal.html',
})
export class XzAuthModal {
  protected readonly auth = inject(AuthFlow);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly closed = output<void>();
  readonly businessCreated = output<BusinessCreated>();

  protected readonly redirecting = this.auth.redirecting;

  private readonly logoFailed = signal<string[]>([]);

  protected choose(provider: Idp) {
    this.auth.signInWith(provider);
  }

  protected readonly submitted = signal(false);
  protected readonly addingCategory = signal(false);

  protected readonly business = new FormGroup({
    b_first: new FormControl(''),
    b_last: new FormControl(''),
    b_email: new FormControl(''),
    b_phone: new FormControl(''),
    b_role: new FormControl(''),
    b_size: new FormControl(''),
    b_name: new FormControl('', filledName),
    b_cat: new FormControl('', chosen),
    b_desc: new FormControl(''),
    b_type: new FormControl(''),
    b_goal: new FormControl(''),
    b_hours: new FormControl('', chosen),
    b_from: new FormControl('09:00'),
    b_to: new FormControl('18:00'),
    b_web: new FormControl(''),
    b_gbp: new FormControl(''),
    b_addr: new FormControl(''),
    b_fb: new FormControl(''),
    b_ig: new FormControl(''),
    b_li: new FormControl(''),
  });

  protected showLogo(provider: Idp): boolean {
    return !!provider.logoSrc && !this.logoFailed().includes(provider.idp);
  }

  protected onLogoError(provider: Idp) {
    this.logoFailed.update((failed) =>
      failed.includes(provider.idp) ? failed : [...failed, provider.idp],
    );
  }

  protected pickCategory(category: string) {
    this.addingCategory.set(false);
    this.business.get('b_cat')!.setValue(category);
  }

  protected startNewCategory() {
    this.addingCategory.set(true);
    this.business.get('b_cat')!.setValue('');
  }

  protected bad(control: string): boolean {
    return this.submitted() && this.business.get(control)!.invalid;
  }

  protected continue() {
    this.submitted.set(true);
    if (this.business.invalid) {
      this.focusFirstInvalid();
      return;
    }

    this.auth.submitBusiness(this.businessData(), {
      next: (created) => {
        this.businessCreated.emit(created);
        this.close();
      },
      error: () => {
        // Surfaced inline via auth.submitError() — nothing further to do here.
      },
    });
  }

  protected close() {
    this.closed.emit();
    this.submitted.set(false);
    this.addingCategory.set(false);
    this.business.reset({ b_from: '09:00', b_to: '18:00' });
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.close();
  }

  private businessData(): InstanceData {
    const value = this.business.getRawValue();
    return {
      ...this.compact({
        'First Name': value.b_first,
        'Last Name': value.b_last,
        'Work Email': value.b_email,
        'Phone Number': value.b_phone,
        'Role / Position ': value.b_role,
        'Company Size': value.b_size,
        'Business Name': value.b_name,
        'Business Category': value.b_cat,
        'Short Description': value.b_desc,
        'Business Type': value.b_type,
        'Primary Goal': value.b_goal,
        'Website URL': value.b_web,
        'Google Business Profile Link': value.b_gbp,
        'Business Address': value.b_addr,
        'Facebook Link': value.b_fb,
        'Instagram Link': value.b_ig,
        'Linkedin Link': value.b_li,
      }),
      'Availabilty Hours': AVAILABILITY_DAYS[value.b_hours ?? ''] ?? ALL_DAYS,
    };
  }

  private compact(fields: Record<string, string | null>): Record<string, string> {
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      const trimmed = String(value ?? '').trim();
      if (trimmed) data[key] = trimmed;
    }
    return data;
  }

  private focusFirstInvalid() {
    const name = Object.keys(this.business.controls).find(
      (key) => this.business.get(key)!.invalid,
    );
    if (!name) return;
    this.host.nativeElement.querySelector<HTMLElement>(`[formControlName="${name}"]`)?.focus();
  }
}
