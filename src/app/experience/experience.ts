import { Component, signal } from '@angular/core';
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
  imports: [XzChrome, XzMarquee, XzValueMap, XzWorkbench, XzChannels, XzOnboarding, XzRoi, XzLead],
  templateUrl: './experience.html',
})
export class Experience {
  protected readonly region = signal<Region>(REGIONS[0]);
  protected readonly plan = signal<Plan>(PLANS[1]);

  protected onRegionChange(region: Region) {
    this.region.set(region);
  }

  protected onPlanSelected(plan: Plan) {
    this.plan.set(plan);
  }
}
