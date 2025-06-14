import { GmailModule } from './gmail.module';

describe('GmailModule', () => {
  it('should be defined', () => {
    expect(GmailModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', GmailModule);
    const providers = Reflect.getMetadata('providers', GmailModule);
    const exports = Reflect.getMetadata('exports', GmailModule);

    // Check imports exist
    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);

    // Check providers exist
    expect(providers).toBeDefined();
    expect(providers.length).toBeGreaterThan(0);

    // Check exports exist
    expect(exports).toBeDefined();
    expect(exports.length).toBeGreaterThan(0);

    // Check for specific providers
    const providerNames = providers
      .filter((p: any) => p && (p.name || p.provide))
      .map((p: any) => p.name || p.provide?.name || p.provide);

    expect(providerNames).toContain('GmailService');
    expect(providerNames).toContain('GmailSyncService');
    expect(providerNames).toContain('EmailAccountService');
    expect(providerNames).toContain('EmailParserService');
    expect(providerNames).toContain('GmailHistoryService');
  });
});