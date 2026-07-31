import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../reveal';

@Component({
  selector: 'app-hero',
  imports: [Reveal, RouterLink],
  templateUrl: './hero.html',
})
export class Hero {}
