import { Component, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { REGIONS, Region } from '../experience-data';
import { AuthFlow } from '../auth-flow';

@Component({
  selector: 'app-xz-chrome',
  imports: [RouterLink],
  templateUrl: './chrome.html',
})
export class XzChrome {
  protected readonly auth = inject(AuthFlow);

  protected readonly regions = REGIONS;
  protected readonly region = signal<Region>(REGIONS[0]);
  protected readonly menuOpen = signal(false);

  readonly brandName = input('');
  protected readonly displayName = computed(() => this.brandName().trim() || 'Cynosure');

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

  @HostListener('document:click')
  protected closeMenu() {
    this.menuOpen.set(false);
    this.auth.clearError();
  }
}
