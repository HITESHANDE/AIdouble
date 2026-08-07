import { Routes } from '@angular/router';
import { AuthRedirect } from './auth-redirect/auth-redirect';
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
  {
    path: 'auth-redirect',
    component: AuthRedirect,
    title: 'AI Double — Signing you in',
  },
  { path: '**', redirectTo: '' },
];
