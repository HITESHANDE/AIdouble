import { Component, inject, signal } from '@angular/core';
import { AuthFlow, BusinessCreated } from '../experience/auth-flow';
import { XzAuthModal } from '../experience/auth-modal/auth-modal';
import { XzWorkbench } from '../experience/workbench/workbench';

@Component({
  selector: 'app-cynosure',
  imports: [XzWorkbench, XzAuthModal],
  templateUrl: './cynosure.html',
})
export class Cynosure {
  protected readonly auth = inject(AuthFlow);

  protected readonly brandName = signal('AI Double');
  protected readonly presetCategory = signal<string | null>(null);
  protected readonly registeredBusiness = signal<BusinessCreated | null>(null);

  protected onBrandNameChange(name: string) {
    this.brandName.set(name);
  }

  protected onBusinessCreated(created: BusinessCreated) {
    this.brandName.set(created.name);
    this.presetCategory.set(created.category);
    this.registeredBusiness.set(created);
  }
}
