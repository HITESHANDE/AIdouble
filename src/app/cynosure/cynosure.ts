import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthFlow, BusinessCreated } from '../experience/auth-flow';
import { AuthSession } from '../experience/auth-session';
import { JobTypesApi } from '../experience/jobtypes-api';
import { XzAuthModal } from '../experience/auth-modal/auth-modal';
import { XzWorkbench } from '../experience/workbench/workbench';

@Component({
  selector: 'app-cynosure',
  imports: [XzWorkbench, XzAuthModal],
  templateUrl: './cynosure.html',
})
export class Cynosure implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly jobTypes = inject(JobTypesApi);
  private readonly session = inject(AuthSession);
  protected readonly auth = inject(AuthFlow);

  protected readonly brandName = signal('AI Double');
  protected readonly presetCategory = signal<string | null>(null);
  protected readonly registeredBusiness = signal<BusinessCreated | null>(null);
  protected readonly onlyCategory = signal<string | null>(null);
  protected readonly businessName = signal('');
  protected readonly businessId = signal<string | null>(null);

  async ngOnInit() {
    this.session.loadSampleUser();

    const slug = this.route.snapshot.url[0]?.path;
    if (!slug) return;

    this.businessName.set(slug);

    try {
      const found = await this.jobTypes.findBySlug(slug);
      if (!found) return;
      this.onlyCategory.set(found.category);
      this.businessId.set(found.id);
      if (found.firstName) this.businessName.set(found.firstName);
    } catch {
      this.onlyCategory.set(null);
    }
  }

  protected onBrandNameChange(name: string) {
    this.brandName.set(name);
  }

  protected onBusinessCreated(created: BusinessCreated) {
    this.brandName.set(created.name);
    this.presetCategory.set(created.category);
    this.registeredBusiness.set(created);
  }
}
