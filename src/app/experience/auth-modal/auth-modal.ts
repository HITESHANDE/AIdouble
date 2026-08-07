import { Component, HostListener, inject, input, output, signal } from '@angular/core';
import { AuthFlow } from '../auth-flow';
import { Idp } from '../idps-api';

@Component({
  selector: 'app-xz-auth-modal',
  templateUrl: './auth-modal.html',
})
export class XzAuthModal {
  private readonly auth = inject(AuthFlow);

  readonly providers = input<Idp[]>([]);
  readonly closed = output<void>();

  protected readonly redirecting = this.auth.redirecting;

  private readonly logoFailed = signal<string[]>([]);

  protected choose(provider: Idp) {
    this.auth.signInWith(provider);
  }

  protected showLogo(provider: Idp): boolean {
    return !!provider.logoSrc && !this.logoFailed().includes(provider.idp);
  }

  protected onLogoError(provider: Idp) {
    this.logoFailed.update((failed) =>
      failed.includes(provider.idp) ? failed : [...failed, provider.idp],
    );
  }

  protected close() {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.close();
  }
}
