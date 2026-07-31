import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-nav',
  imports: [],
  templateUrl: './nav.html',
  host: {
    '(window:scroll)': 'onScroll()',
  },
})
export class Nav {
  protected readonly scrolled = signal(window.scrollY > 14);
  protected readonly menuOpen = signal(false);

  protected onScroll() {
    this.scrolled.set(window.scrollY > 14);
  }

  protected toggleMenu() {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu() {
    this.menuOpen.set(false);
  }
}
