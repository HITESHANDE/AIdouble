import { Component } from '@angular/core';

@Component({
  selector: 'app-xz-marquee',
  templateUrl: './marquee.html',
})
export class XzMarquee {
  protected readonly items = [
    '1.4s to first answer',
    'no hold music',
    'answers with receipts',
    'हिंदी · मराठी · English',
    'live in a week',
    'your brand, not ours',
    '₹199 to start',
  ];
}
