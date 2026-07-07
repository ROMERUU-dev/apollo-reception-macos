import type { DrawerReasonCode, DrawerResult, OpenDrawerRequest } from '@apollo/bridge-contract';
import type { ApolloDesktopBridge } from '@apollo/bridge-client';

export interface HardwareActionGrantProvider {
  requestDrawerGrant(reasonCode: DrawerReasonCode, context: { cashSessionId: string; relatedEntityId?: string }): Promise<OpenDrawerRequest>;
}

export class CashDrawerService {
  constructor(private readonly bridge: ApolloDesktopBridge, private readonly grants: HardwareActionGrantProvider) {}

  async openAuthorized(reasonCode: DrawerReasonCode, context: { cashSessionId: string; relatedEntityId?: string }): Promise<DrawerResult> {
    const capabilities = await this.bridge.getCapabilities();
    if (!capabilities.capabilities.cashDrawer) throw new Error(`Cash drawer is unavailable on ${capabilities.platform}.`);
    const grant = await this.grants.requestDrawerGrant(reasonCode, context);
    if (grant.reasonCode !== reasonCode) throw new Error('Backend hardware grant reason does not match the requested action.');
    return this.bridge.openDrawer(grant);
  }
}
