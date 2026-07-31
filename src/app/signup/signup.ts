import { Component, ElementRef, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

export type AccountType = 'individual' | 'business' | 'broker';

const filledName = (control: AbstractControl) =>
  String(control.value ?? '').trim().length > 1 ? null : { filledName: true };

const validEmail = (control: AbstractControl) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(control.value ?? '')) ? null : { validEmail: true };

const validPhone = (control: AbstractControl) =>
  String(control.value ?? '').replace(/\D/g, '').length >= 7 ? null : { validPhone: true };

const chosen = (control: AbstractControl) =>
  String(control.value ?? '') !== '' ? null : { chosen: true };

const DONE_HEADING: Record<AccountType, string> = {
  individual: 'Your account is ready',
  business: 'Business submitted',
  broker: 'Broker application received',
};

const DONE_NOTE: Record<AccountType, string> = {
  individual:
    'Your account has been created. Next, download the app to finish setting up your Double.',
  business:
    "Thanks — we'll review the business details and get your Double listed. Download the app to manage it.",
  broker:
    "Thanks — our team will verify your licence and get back to you. Download the app to track your status.",
};

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly current = signal<AccountType>('individual');
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly fileName = signal('');
  protected readonly dragging = signal(false);

  protected readonly individual = new FormGroup({
    name: new FormControl('', filledName),
    email: new FormControl('', validEmail),
    dialcode: new FormControl('+91'),
    mobile: new FormControl('', validPhone),
    address: new FormControl(''),
    city: new FormControl(''),
    country: new FormControl('India'),
  });

  protected readonly business = new FormGroup({
    b_first: new FormControl(''),
    b_last: new FormControl(''),
    b_email: new FormControl(''),
    b_phone: new FormControl(''),
    b_role: new FormControl(''),
    b_size: new FormControl(''),
    b_name: new FormControl('', filledName),
    b_cat: new FormControl(''),
    b_subcat: new FormControl(''),
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

  protected readonly broker = new FormGroup({
    k_name: new FormControl('', filledName),
    k_code: new FormControl(''),
    k_cat: new FormControl(''),
    k_subcat: new FormControl(''),
    k_desc: new FormControl(''),
    k_email: new FormControl('', validEmail),
    k_phone: new FormControl('', validPhone),
    k_addr: new FormControl(''),
    k_gst: new FormControl(''),
    k_tan: new FormControl(''),
    k_cin: new FormControl(''),
    k_lic: new FormControl(''),
    k_licexp: new FormControl(''),
    k_bank: new FormControl(''),
  });

  constructor() {
    const type = inject(ActivatedRoute).snapshot.queryParamMap.get('type');
    if (type === 'individual' || type === 'business' || type === 'broker') {
      this.current.set(type);
    }
  }

  protected doneHeading() {
    return DONE_HEADING[this.current()];
  }

  protected doneNote() {
    return DONE_NOTE[this.current()];
  }

  protected select(type: AccountType) {
    this.current.set(type);
    this.submitted.set(false);
  }

  protected bad(group: FormGroup, control: string) {
    return this.submitted() && group.get(control)!.invalid;
  }

  protected openPicker(input: HTMLInputElement) {
    input.click();
  }

  protected pickerKeydown(event: KeyboardEvent, input: HTMLInputElement) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  }

  protected dragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected dragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
  }

  protected drop(event: DragEvent, input: HTMLInputElement) {
    event.preventDefault();
    this.dragging.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      input.files = files;
      this.fileName.set(files[0].name);
    }
  }

  protected fileChosen(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      this.fileName.set(files[0].name);
    }
  }

  protected submit(event: Event) {
    event.preventDefault();
    this.submitted.set(true);
    const group = this.activeGroup();
    if (group.invalid) {
      this.focusFirstInvalid(group);
      return;
    }
    this.submitting.set(true);
    setTimeout(() => {
      this.submitting.set(false);
      this.done.set(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 800);
  }

  private activeGroup() {
    if (this.current() === 'business') return this.business;
    if (this.current() === 'broker') return this.broker;
    return this.individual;
  }

  private focusFirstInvalid(group: FormGroup) {
    const name = Object.keys(group.controls).find((key) => group.get(key)!.invalid);
    if (!name) return;
    this.host.nativeElement
      .querySelector<HTMLElement>(`[formControlName="${name}"]`)
      ?.focus();
  }
}
