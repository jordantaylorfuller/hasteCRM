import { AppModule } from './app.module';

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined();
  });

  it('should have correct metadata', () => {
    const imports = Reflect.getMetadata('imports', AppModule);
    const providers = Reflect.getMetadata('providers', AppModule);

    // Check imports exist
    expect(imports).toBeDefined();
    expect(imports.length).toBeGreaterThan(0);

    // Check for essential modules
    const moduleNames = imports
      .filter((m: any) => m && m.name)
      .map((m: any) => m.name);

    expect(moduleNames).toContain('ConfigModule');
    expect(moduleNames).toContain('GraphQLModule');
    expect(moduleNames).toContain('PrismaModule');
    expect(moduleNames).toContain('AuthModule');
    expect(moduleNames).toContain('ContactsModule');
    expect(moduleNames).toContain('CompaniesModule');
    expect(moduleNames).toContain('GmailModule');
    expect(moduleNames).toContain('PipelinesModule');
    expect(moduleNames).toContain('WebhooksModule');
    expect(moduleNames).toContain('HealthModule');
  });

  it('should configure GraphQL module', () => {
    const imports = Reflect.getMetadata('imports', AppModule);
    const graphqlConfig = imports.find((m: any) => 
      m.module && m.module.name === 'GraphQLModule'
    );

    expect(graphqlConfig).toBeDefined();
  });
});