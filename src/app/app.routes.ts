import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Signup } from './signup/signup';

export const routes: Routes = [
  {
    path: '',
    component: Landing,
    title: 'AI Double — Create the version of you that never drops the ball.',
  },
  {
    path: 'signup',
    component: Signup,
    title: 'AI Double — Create your account',
  },
  { path: '**', redirectTo: '' },
];
