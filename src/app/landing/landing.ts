import { Component } from '@angular/core';
import { Nav } from '../nav/nav';
import { Hero } from '../hero/hero';
import { Try } from '../try/try';
import { OnePlace } from '../one-place/one-place';
import { Why } from '../why/why';
import { Trust } from '../trust/trust';
import { UseCases } from '../use-cases/use-cases';
import { How } from '../how/how';
import { Pricing } from '../pricing/pricing';
import { Faq } from '../faq/faq';
import { Download } from '../download/download';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-landing',
  imports: [Nav, Hero, Try, OnePlace, Why, Trust, UseCases, How, Pricing, Faq, Download, Footer],
  templateUrl: './landing.html',
})
export class Landing {}
