// ===========================================
// Messaging Provider Registry
// ===========================================

import type { MessagingProvider, MessagingProviderAdapter } from '@signalmash-connect/shared';
import { signalmashProvider } from '../providers/signalmash.provider.js';

class ProviderRegistryService {
  private readonly providers = new Map<MessagingProvider, MessagingProviderAdapter>([
    [signalmashProvider.provider, signalmashProvider],
  ]);

  get(provider: MessagingProvider): MessagingProviderAdapter {
    const adapter = this.providers.get(provider);

    if (!adapter) {
      throw new Error(`No messaging provider adapter registered for ${provider}`);
    }

    return adapter;
  }
}

export const providerRegistry = new ProviderRegistryService();
