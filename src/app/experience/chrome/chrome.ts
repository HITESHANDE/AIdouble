import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { REGIONS, Region } from '../experience-data';
import { AuthFlow } from '../auth-flow';
import { AuthSession } from '../auth-session';
import { LivekitVoice } from '../livekit-voice';

@Component({
  selector: 'app-xz-chrome',
  imports: [RouterLink],
  templateUrl: './chrome.html',
})
export class XzChrome {
  protected readonly auth = inject(AuthFlow);
  protected readonly session = inject(AuthSession);
  private readonly voice = inject(LivekitVoice);

  protected readonly regions = REGIONS;
  protected readonly region = signal<Region>(REGIONS[0]);
  protected readonly menuOpen = signal(false);
  protected readonly userMenuOpen = signal(false);

  readonly brandName = input('');
  protected readonly displayName = computed(() => this.brandName().trim() || 'AI Double');

  readonly regionChange = output<Region>();

  protected toggleMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected selectRegion(region: Region) {
    this.region.set(region);
    this.menuOpen.set(false);
    this.regionChange.emit(region);
  }

  protected openAuth(event: Event) {
    event.preventDefault();
    this.auth.start('chrome');
  }

  protected toggleUserMenu(event: Event) {
    event.stopPropagation();
    this.userMenuOpen.update((v) => !v);
  }

  protected async signOut() {
    this.userMenuOpen.set(false);

    if (this.voice.isActive) {
      await this.voice.stop().catch(() => undefined);
    }

    this.session.clear();
    window.location.assign('/');
  }

  @HostListener('document:click')
  protected closeMenu() {
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
    this.auth.clearError();
  }
}
