import { AfterViewInit, Directive, ElementRef, Injectable, OnDestroy, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RevealObserver {
  private readonly observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          this.observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.14, rootMargin: '0px 0px -40px 0px' },
  );

  observe(element: Element) {
    this.observer.observe(element);
  }

  unobserve(element: Element) {
    this.observer.unobserve(element);
  }
}

@Directive({ selector: '.rv' })
export class Reveal implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<Element>>(ElementRef);
  private readonly revealObserver = inject(RevealObserver);

  ngAfterViewInit() {
    this.revealObserver.observe(this.element.nativeElement);
  }

  ngOnDestroy() {
    this.revealObserver.unobserve(this.element.nativeElement);
  }
}
