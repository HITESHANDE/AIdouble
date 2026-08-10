import { Component, inject, signal } from '@angular/core';
import { AuthFlow, BusinessCreated } from './auth-flow';
import { XzAuthModal } from './auth-modal/auth-modal';
import { XzChrome } from './chrome/chrome';
import { XzMarquee } from './marquee/marquee';
import { XzValueMap } from './value-map/value-map';
import { XzWorkbench } from './workbench/workbench';
import { XzChannels } from './channels/channels';
import { XzOnboarding } from './onboarding/onboarding';
import { XzRoi } from './roi/roi';
import { XzLead } from './lead/lead';
import { PLANS, Plan, REGIONS, Region } from './experience-data';

@Component({
  selector: 'app-experience',
  imports: [XzChrome, XzMarquee, XzValueMap, XzWorkbench, XzChannels, XzOnboarding, XzRoi, XzLead, XzAuthModal],
  templateUrl: './experience.html',
})
export class Experience {
  protected readonly auth = inject(AuthFlow);

  protected readonly region = signal<Region>(REGIONS[0]);
  protected readonly plan = signal<Plan>(PLANS[1]);
  // White-label preview name — edited from the workbench's "Preview as"
  // field, shown everywhere the page would otherwise say "AI Double".
  protected readonly brandName = signal('AI Double');
  // Category chosen/created in the sign-in flow's "About your business"
  // step — tells the workbench which industry to select, when one matches.
  protected readonly presetCategory = signal<string | null>(null);
  // Set once "About your business" is submitted — from then on the
  // workbench locks onto this business instead of staying a generic demo:
  // brand name becomes fixed, the rail narrows to just this industry, and
  // the upload CTA switches from "sign in" to "upload your knowledge".
  protected readonly registeredBusiness = signal<BusinessCreated | null>(null);

  protected onRegionChange(region: Region) {
    this.region.set(region);
  }

  protected onBrandNameChange(name: string) {
    this.brandName.set(name);
  }

  protected onBusinessCreated(created: BusinessCreated) {
    this.brandName.set(created.name);
    this.presetCategory.set(created.category);
    this.registeredBusiness.set(created);
  }

  protected onPlanSelected(plan: Plan) {
    this.plan.set(plan);
  }
}
