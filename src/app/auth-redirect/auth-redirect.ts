import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthSession } from '../experience/auth-session';
import { SsoApi } from '../experience/sso-api';

@Component({
  selector: 'app-auth-redirect',
  imports: [RouterLink],
  templateUrl: './auth-redirect.html',
})
export class AuthRedirect implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sso = inject(SsoApi);
  private readonly session = inject(AuthSession);

  protected readonly error = signal('');

  ngOnInit() {
    const sessionId = this.route.snapshot.queryParamMap.get('sessionId');
    if (!sessionId) {
      this.error.set('That sign-in link is missing its session. Please try again.');
      return;
    }

    this.sso.sessionLogin(sessionId, {
      next: (response) => {
        if (!this.session.save(response)) {
          this.error.set(response.msg || 'Sign-in could not be completed. Please try again.');
          return;
        }
        this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (message) => this.error.set(message),
    });
  }
}
