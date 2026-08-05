import { Routes } from '@angular/router';
import { Experience } from './experience/experience';
import { Signup } from './signup/signup';

export const routes: Routes = [
  {
    path: '',
    component: Experience,
    title: 'AI Double — Experience Zone',
  },
  {
    path: 'signup',
    component: Signup,
    title: 'AI Double — Create your account',
  },
  { path: '**', redirectTo: '' },
];
