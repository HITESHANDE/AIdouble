import { Component, HostListener, input, output, signal } from '@angular/core';
import { Idp } from '../idps-api';

@Component({
  selector: 'app-xz-auth-modal',
  templateUrl: './auth-modal.html',
})
export class XzAuthModal {
  readonly providers = input<Idp[]>([]);
  readonly closed = output<void>();

  private readonly logoFailed = signal<string[]>([]);

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
