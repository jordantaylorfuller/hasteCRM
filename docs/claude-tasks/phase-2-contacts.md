# Phase 2: Contact Management System

## 🎯 Phase Overview

**Duration**: 3 weeks  
**Priority**: High  
**Dependencies**: Phase 1 (Foundation) must be complete  
**Success Criteria**: Fully functional contact management with <100ms search, 95%+ enrichment accuracy  
**Team Size**: 2-3 developers  

Build a comprehensive contact management system with advanced segmentation, import/export capabilities, AI-powered enrichment, and real-time activity tracking.

## 📋 Goals

- [x] Create flexible, extensible contact data model with custom fields
- [x] Implement blazing-fast search with Elasticsearch integration
- [x] Build robust import/export with duplicate detection
- [x] Add AI-powered contact enrichment and insights
- [x] Enable hierarchical tags and smart segmentation
- [x] Create real-time activity tracking system
- [x] Implement data quality monitoring
- [x] Build comprehensive GraphQL API

## 🚀 Prerequisites

Before starting Phase 2:
- Phase 1 completed with all tests passing
- Elasticsearch 8+ installed (or using cloud service)
- API keys for enrichment services (Clearbit, Perplexity)
- Redis configured for queuing
- S3/MinIO for file storage

## 📝 Detailed Tasks

### 1. Enhanced Contact Model (Days 1-3)

#### 1.1 Prisma Schema Extensions
```prisma
// Add to packages/database/prisma/schema.prisma

model Contact {
  id              String    @id @default(cuid())
  
  // Basic Information
  email           String
  emailVerified   Boolean   @default(false)
  firstName       String?
  lastName        String?
  fullName        String?   // Computed or provided
  phone           String?
  phoneType       PhoneType?
  
  // Professional Information
  title           String?
  department      String?
  seniority       Seniority?
  
  // Company Relationship
  companyId       String?
  company         Company?  @relation(fields: [companyId], references: [id])
  
  // Social Profiles
  linkedinUrl     String?
  twitterHandle   String?
  facebookUrl     String?
  instagramHandle String?
  githubUsername  String?
  personalWebsite String?
  
  // Contact Source & Attribution
  source          ContactSource @default(DIRECT)
  sourceDetails   Json?     // Campaign ID, referrer, etc.
  firstSeen       DateTime  @default(now())
  
  // Lifecycle & Engagement
  lifecycleStage  LifecycleStage @default(SUBSCRIBER)
  leadStatus      LeadStatus?
  score           Int       @default(0)
  temperature     Temperature @default(COLD)
  lastActivityAt  DateTime?
  
  // Data Quality
  enrichedAt      DateTime?
  enrichmentData  Json?     // Raw enrichment data
  dataQuality     Int       @default(0) // 0-100 score
  isComplete      Boolean   @default(false)
  
  // Workspace
  workspaceId     String
  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  
  // Relationships
  ownerId         String?
  owner           User?     @relation(fields: [ownerId], references: [id])
  activities      Activity[]
  emails          Email[]
  meetings        Meeting[]
  notes           Note[]
  tasks           Task[]
  deals           Deal[]
  customFields    ContactCustomField[]
  tags            ContactTag[]
  lists           ContactList[]
  relationships   ContactRelationship[] @relation("FromContact")
  relatedTo       ContactRelationship[] @relation("ToContact")
  
  // Metadata
  customData      Json?     @default("{}")
  isArchived      Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdBy       String?
  updatedBy       String?
  
  @@unique([workspaceId, email])
  @@index([workspaceId, lifecycleStage])
  @@index([workspaceId, score])
  @@index([workspaceId, lastActivityAt])
  @@index([companyId])
  @@index([ownerId])
  @@index([createdAt])
  
  // Full-text search
  @@index([email, firstName, lastName, company])
}

model Company {
  id              String    @id @default(cuid())
  name            String
  domain          String?   @unique
  website         String?
  
  // Company Details
  industry        String?
  size            CompanySize?
  founded         Int?
  description     String?
  
  // Location
  headquarters    String?
  locations       Json?     // Array of locations
  
  // Financial
  revenue         BigInt?
  fundingTotal    BigInt?
  lastFunding     DateTime?
  
  // Technology
  techStack       String[]  // Technologies used
  
  // Social
  linkedinUrl     String?
  twitterHandle   String?
  
  // Enrichment
  logoUrl         String?
  enrichedAt      DateTime?
  enrichmentData  Json?
  
  // Relations
  contacts        Contact[]
  deals           Deal[]
  
  // Metadata
  workspaceId     String
  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([workspaceId, domain])
  @@index([workspaceId, name])
}

model ContactRelationship {
  id              String    @id @default(cuid())
  
  fromContactId   String
  fromContact     Contact   @relation("FromContact", fields: [fromContactId], references: [id])
  
  toContactId     String
  toContact       Contact   @relation("ToContact", fields: [toContactId], references: [id])
  
  type            RelationshipType
  strength        Int       @default(50) // 0-100
  notes           String?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([fromContactId, toContactId, type])
  @@index([fromContactId])
  @@index([toContactId])
}

// Enums
enum ContactSource {
  DIRECT
  IMPORT
  API
  FORM
  EMAIL
  SOCIAL
  REFERRAL
  PARTNER
  ENRICHMENT
  MANUAL
}

enum LifecycleStage {
  SUBSCRIBER
  LEAD
  MQL
  SQL
  OPPORTUNITY
  CUSTOMER
  EVANGELIST
  OTHER
}

enum Temperature {
  HOT
  WARM
  COLD
}

enum RelationshipType {
  REPORTS_TO
  MANAGES
  COLLEAGUE
  KNOWS
  PARTNER
  VENDOR
  CUSTOMER
  ADVISOR
  INVESTOR
  REFERRAL
}
```

#### 1.2 Contact Service Implementation
```typescript
// apps/api/src/modules/contacts/contacts.service.ts

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private elastic: ElasticsearchService,
    private enrichment: EnrichmentService,
    private events: EventBus,
    private ai: AIService,
  ) {}

  async create(data: CreateContactDto, userId: string): Promise<Contact> {
    // 1. Validate and normalize data
    const normalized = await this.normalizeContactData(data);
    
    // 2. Check for duplicates
    const duplicates = await this.findDuplicates(normalized);
    if (duplicates.length > 0) {
      throw new DuplicateContactError(duplicates);
    }
    
    // 3. Create contact with transaction
    const contact = await this.prisma.$transaction(async (tx) => {
      // Create contact
      const created = await tx.contact.create({
        data: {
          ...normalized,
          createdBy: userId,
          score: await this.calculateInitialScore(normalized),
        },
        include: this.defaultIncludes,
      });
      
      // Create activity
      await tx.activity.create({
        data: {
          type: 'CONTACT_CREATED',
          contactId: created.id,
          userId,
          metadata: { source: normalized.source },
        },
      });
      
      return created;
    });
    
    // 4. Queue for enrichment
    await this.enrichment.queueEnrichment(contact.id);
    
    // 5. Index in Elasticsearch
    await this.elastic.index('contacts', contact);
    
    // 6. Emit event
    await this.events.emit(new ContactCreatedEvent(contact));
    
    return contact;
  }

  async calculateInitialScore(data: Partial<Contact>): Promise<number> {
    let score = 0;
    
    // Email verification bonus
    if (data.emailVerified) score += 10;
    
    // Profile completeness
    const fields = ['firstName', 'lastName', 'phone', 'title', 'company'];
    const filledFields = fields.filter(f => data[f]);
    score += (filledFields.length / fields.length) * 20;
    
    // Source quality
    const sourceScores = {
      REFERRAL: 30,
      DIRECT: 20,
      FORM: 15,
      IMPORT: 10,
      ENRICHMENT: 5,
    };
    score += sourceScores[data.source] || 0;
    
    // Professional indicators
    if (data.title?.match(/C-level|VP|Director|Manager/i)) score += 20;
    if (data.companyId) score += 10;
    
    return Math.min(score, 100);
  }
}
```

### 2. Advanced Search & Filtering (Days 4-6)

#### 2.1 Elasticsearch Integration
```typescript
// apps/api/src/modules/search/search.service.ts

@Injectable()
export class ContactSearchService {
  private readonly index = 'contacts';
  
  async search(params: SearchParams): Promise<SearchResult<Contact>> {
    const query = this.buildQuery(params);
    
    const response = await this.elastic.search({
      index: this.index,
      body: {
        query,
        aggs: this.buildAggregations(params),
        highlight: {
          fields: {
            'firstName': {},
            'lastName': {},
            'email': {},
            'company.name': {},
          },
        },
        from: params.offset || 0,
        size: params.limit || 20,
        sort: this.buildSort(params),
      },
    });
    
    return {
      items: response.hits.hits.map(hit => ({
        ...hit._source,
        _score: hit._score,
        _highlights: hit.highlight,
      })),
      total: response.hits.total.value,
      aggregations: response.aggregations,
      took: response.took,
    };
  }

  private buildQuery(params: SearchParams): any {
    const must = [];
    const filter = [];
    
    // Full-text search
    if (params.query) {
      must.push({
        multi_match: {
          query: params.query,
          fields: [
            'firstName^3',
            'lastName^3',
            'email^2',
            'company.name^2',
            'title',
            'phone',
            'notes.content',
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }
    
    // Filters
    if (params.filters) {
      // Lifecycle stage
      if (params.filters.lifecycleStage) {
        filter.push({
          terms: { lifecycleStage: params.filters.lifecycleStage },
        });
      }
      
      // Score range
      if (params.filters.scoreRange) {
        filter.push({
          range: {
            score: {
              gte: params.filters.scoreRange.min,
              lte: params.filters.scoreRange.max,
            },
          },
        });
      }
      
      // Date ranges
      if (params.filters.createdAfter) {
        filter.push({
          range: {
            createdAt: { gte: params.filters.createdAfter },
          },
        });
      }
      
      // Custom fields
      if (params.filters.customFields) {
        Object.entries(params.filters.customFields).forEach(([key, value]) => {
          filter.push({
            nested: {
              path: 'customFields',
              query: {
                bool: {
                  must: [
                    { term: { 'customFields.key': key } },
                    { term: { 'customFields.value': value } },
                  ],
                },
              },
            },
          });
        });
      }
    }
    
    return {
      bool: {
        must,
        filter: [
          ...filter,
          { term: { workspaceId: params.workspaceId } },
          { term: { isArchived: false } },
        ],
      },
    };
  }
}
```

#### 2.2 Smart Lists Implementation
```typescript
// Smart list with dynamic criteria
@Injectable()
export class SmartListService {
  async evaluateSmartList(listId: string): Promise<string[]> {
    const list = await this.prisma.contactList.findUnique({
      where: { id: listId },
      include: { criteria: true },
    });
    
    if (!list.isSmartList) {
      throw new Error('Not a smart list');
    }
    
    // Build dynamic query from criteria
    const query = this.buildQueryFromCriteria(list.criteria);
    
    // Execute search
    const results = await this.searchService.search({
      ...query,
      limit: 10000, // Max for smart lists
    });
    
    // Update list membership
    await this.updateListMembership(listId, results.items.map(c => c.id));
    
    return results.items.map(c => c.id);
  }

  private buildQueryFromCriteria(criteria: ListCriteria[]): SearchParams {
    const filters: any = {};
    
    criteria.forEach(criterion => {
      switch (criterion.field) {
        case 'engagement':
          if (criterion.operator === 'GREATER_THAN') {
            filters.scoreRange = { min: criterion.value };
          }
          break;
          
        case 'lastActivity':
          if (criterion.operator === 'WITHIN_DAYS') {
            filters.lastActivityAfter = new Date(
              Date.now() - criterion.value * 24 * 60 * 60 * 1000
            );
          }
          break;
          
        case 'tag':
          filters.tags = filters.tags || [];
          filters.tags.push(criterion.value);
          break;
          
        // Add more criteria types
      }
    });
    
    return { filters };
  }
}
```

### 3. Import/Export System (Days 7-9)

#### 3.1 Advanced Import Pipeline
```typescript
// apps/api/src/modules/import/import.service.ts

@Injectable()
export class ContactImportService {
  constructor(
    private parser: CSVParserService,
    private validator: ValidationService,
    private deduplication: DeduplicationService,
    private queue: Queue,
  ) {}

  async startImport(file: Express.Multer.File, options: ImportOptions): Promise<ImportJob> {
    // 1. Create import job
    const job = await this.prisma.importJob.create({
      data: {
        fileName: file.originalname,
        fileSize: file.size,
        status: 'PARSING',
        options,
        userId: options.userId,
        workspaceId: options.workspaceId,
      },
    });
    
    // 2. Parse file
    const parsed = await this.parser.parse(file, {
      detectDelimiter: true,
      detectEncoding: true,
      preview: 10,
    });
    
    // 3. Auto-detect field mapping
    const mapping = await this.autoDetectMapping(parsed.headers, parsed.preview);
    
    // 4. Queue for processing
    await this.queue.add('process-import', {
      jobId: job.id,
      fileUrl: file.path,
      mapping,
      options,
    });
    
    return job;
  }

  async processImport(jobId: string): Promise<void> {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
    });
    
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    
    // Stream processing for large files
    const stream = this.parser.createReadStream(job.fileUrl);
    const batchSize = 100;
    let batch = [];
    
    stream.on('data', async (row) => {
      batch.push(row);
      
      if (batch.length >= batchSize) {
        stream.pause();
        await this.processBatch(batch, job, stats);
        batch = [];
        stream.resume();
      }
    });
    
    stream.on('end', async () => {
      if (batch.length > 0) {
        await this.processBatch(batch, job, stats);
      }
      
      // Update job status
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          stats,
          completedAt: new Date(),
        },
      });
    });
  }

  private async processBatch(
    rows: any[],
    job: ImportJob,
    stats: ImportStats
  ): Promise<void> {
    const contacts = rows.map(row => this.mapRowToContact(row, job.mapping));
    
    // Validate
    const validationResults = await Promise.all(
      contacts.map(c => this.validator.validateContact(c))
    );
    
    const valid = contacts.filter((_, i) => validationResults[i].isValid);
    const invalid = contacts.filter((_, i) => !validationResults[i].isValid);
    
    // Check duplicates
    const { unique, duplicates } = await this.deduplication.checkBatch(valid);
    
    // Process based on options
    if (job.options.updateExisting) {
      // Update duplicates
      await this.updateContacts(duplicates);
      stats.updated += duplicates.length;
    } else {
      stats.skipped += duplicates.length;
    }
    
    // Create new contacts
    if (unique.length > 0) {
      await this.createContacts(unique, job.options);
      stats.created += unique.length;
    }
    
    // Log errors
    invalid.forEach((contact, i) => {
      stats.errors.push({
        row: stats.total + i,
        errors: validationResults[i].errors,
      });
    });
    
    stats.total += rows.length;
    
    // Update progress
    await this.updateProgress(job.id, stats);
  }
}
```

#### 3.2 Export System
```typescript
// Export with templates and scheduling
@Injectable()
export class ContactExportService {
  async export(params: ExportParams): Promise<ExportJob> {
    const job = await this.prisma.exportJob.create({
      data: {
        status: 'PREPARING',
        format: params.format,
        filters: params.filters,
        fields: params.fields,
        userId: params.userId,
      },
    });
    
    // Queue export
    await this.queue.add('export-contacts', {
      jobId: job.id,
      params,
    });
    
    return job;
  }

  async processExport(jobId: string): Promise<void> {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });
    
    // Get contacts based on filters
    const contacts = await this.getContactsForExport(job.filters);
    
    // Generate export file
    let fileUrl: string;
    
    switch (job.format) {
      case 'CSV':
        fileUrl = await this.generateCSV(contacts, job.fields);
        break;
      case 'EXCEL':
        fileUrl = await this.generateExcel(contacts, job.fields);
        break;
      case 'JSON':
        fileUrl = await this.generateJSON(contacts, job.fields);
        break;
      case 'VCARD':
        fileUrl = await this.generateVCard(contacts);
        break;
    }
    
    // Update job
    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        fileUrl,
        completedAt: new Date(),
      },
    });
    
    // Send notification
    await this.notificationService.notify(job.userId, {
      type: 'EXPORT_COMPLETE',
      data: { jobId, fileUrl },
    });
  }
}
```

### 4. AI-Powered Enrichment (Days 10-12)

#### 4.1 Multi-Source Enrichment Engine
```typescript
// apps/api/src/modules/enrichment/enrichment.service.ts

@Injectable()
export class ContactEnrichmentService {
  private providers = [
    { name: 'clearbit', priority: 1, weight: 0.4 },
    { name: 'perplexity', priority: 2, weight: 0.3 },
    { name: 'hunter', priority: 3, weight: 0.2 },
    { name: 'social', priority: 4, weight: 0.1 },
  ];

  async enrichContact(contactId: string, options?: EnrichmentOptions): Promise<EnrichmentResult> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: { company: true },
    });
    
    // 1. Gather data from multiple sources
    const enrichmentData = await this.gatherEnrichmentData(contact, options);
    
    // 2. Use AI to synthesize and validate
    const synthesized = await this.synthesizeWithAI(enrichmentData);
    
    // 3. Calculate confidence scores
    const confidence = this.calculateConfidence(enrichmentData);
    
    // 4. Update contact with enriched data
    const updated = await this.updateContactWithEnrichment(contact, synthesized, confidence);
    
    // 5. Generate AI insights
    const insights = await this.generateInsights(updated);
    
    return {
      contact: updated,
      sources: enrichmentData.sources,
      confidence,
      insights,
    };
  }

  private async gatherEnrichmentData(
    contact: Contact,
    options?: EnrichmentOptions
  ): Promise<EnrichmentData> {
    const providers = options?.providers || this.providers;
    const results = [];
    
    for (const provider of providers) {
      try {
        const data = await this.fetchFromProvider(provider.name, contact);
        if (data) {
          results.push({
            provider: provider.name,
            data,
            weight: provider.weight,
          });
        }
      } catch (error) {
        this.logger.warn(`Enrichment failed for ${provider.name}`, error);
      }
    }
    
    return {
      sources: results,
      timestamp: new Date(),
    };
  }

  private async synthesizeWithAI(enrichmentData: EnrichmentData): Promise<SynthesizedData> {
    const prompt = `
      Synthesize the following contact enrichment data from multiple sources.
      Resolve conflicts by considering data freshness and source reliability.
      
      Sources:
      ${JSON.stringify(enrichmentData.sources, null, 2)}
      
      Return a unified contact profile with:
      1. Resolved conflicts
      2. Confidence scores for each field
      3. Data quality assessment
      4. Suggested actions for incomplete data
    `;
    
    const response = await this.ai.analyze({
      model: 'claude-3-opus',
      prompt,
      temperature: 0.3,
    });
    
    return response.synthesizedData;
  }

  private async generateInsights(contact: Contact): Promise<ContactInsights> {
    const prompt = `
      Analyze this enriched contact profile and provide:
      1. Key insights about the person
      2. Best communication approach
      3. Potential opportunities
      4. Risk factors
      5. Suggested next actions
      
      Contact: ${JSON.stringify(contact, null, 2)}
    `;
    
    const analysis = await this.ai.analyze({
      model: 'claude-3-sonnet',
      prompt,
    });
    
    return {
      summary: analysis.summary,
      communicationStyle: analysis.communicationStyle,
      opportunities: analysis.opportunities,
      risks: analysis.risks,
      nextActions: analysis.nextActions,
      interests: analysis.interests,
      personality: analysis.personality,
    };
  }
}
```

### 5. Custom Fields System (Days 13-14)

#### 5.1 Dynamic Custom Fields
```typescript
// Custom field management with validation
@Injectable()
export class CustomFieldService {
  async createField(data: CreateCustomFieldDto): Promise<CustomField> {
    // Validate field configuration
    await this.validateFieldConfig(data);
    
    const field = await this.prisma.customField.create({
      data: {
        ...data,
        key: this.generateFieldKey(data.name),
        validation: this.buildValidationRules(data),
      },
    });
    
    // Update Elasticsearch mapping
    await this.elastic.putMapping('contacts', {
      properties: {
        [`customFields.${field.key}`]: this.getESFieldMapping(field),
      },
    });
    
    return field;
  }

  private buildValidationRules(data: CreateCustomFieldDto): any {
    const rules = {};
    
    switch (data.type) {
      case 'TEXT':
        if (data.maxLength) rules.maxLength = data.maxLength;
        if (data.pattern) rules.pattern = data.pattern;
        break;
        
      case 'NUMBER':
        if (data.min !== undefined) rules.min = data.min;
        if (data.max !== undefined) rules.max = data.max;
        if (data.precision) rules.precision = data.precision;
        break;
        
      case 'SELECT':
        rules.options = data.options;
        if (data.multiple) rules.multiple = true;
        break;
        
      case 'DATE':
        if (data.minDate) rules.minDate = data.minDate;
        if (data.maxDate) rules.maxDate = data.maxDate;
        break;
    }
    
    return rules;
  }
}
```

### 6. Advanced Tag System (Days 15-16)

#### 6.1 Hierarchical Tags with Auto-Tagging
```typescript
@Injectable()
export class TagService {
  async createAutoTaggingRule(data: CreateAutoTagRuleDto): Promise<AutoTagRule> {
    const rule = await this.prisma.autoTagRule.create({
      data: {
        ...data,
        conditions: this.buildConditions(data.conditions),
        enabled: true,
      },
    });
    
    // Apply rule to existing contacts
    if (data.applyToExisting) {
      await this.queue.add('apply-auto-tag-rule', {
        ruleId: rule.id,
      });
    }
    
    return rule;
  }

  async evaluateAutoTags(contact: Contact): Promise<string[]> {
    const rules = await this.prisma.autoTagRule.findMany({
      where: {
        workspaceId: contact.workspaceId,
        enabled: true,
      },
    });
    
    const tags = [];
    
    for (const rule of rules) {
      if (await this.evaluateRule(rule, contact)) {
        tags.push(...rule.tagIds);
      }
    }
    
    // AI-suggested tags
    const aiTags = await this.suggestTagsWithAI(contact);
    tags.push(...aiTags);
    
    return [...new Set(tags)];
  }

  private async suggestTagsWithAI(contact: Contact): Promise<string[]> {
    const prompt = `
      Suggest relevant tags for this contact based on:
      - Their professional information
      - Company details
      - Engagement history
      - Email content
      
      Contact: ${JSON.stringify(contact, null, 2)}
      
      Available tags: ${await this.getAvailableTags()}
      
      Return only tag IDs that are highly relevant.
    `;
    
    const suggestions = await this.ai.suggest({
      model: 'claude-3-haiku',
      prompt,
    });
    
    return suggestions.tagIds;
  }
}
```

### 7. Real-time Activity Tracking (Days 17-18)

#### 7.1 Activity Stream Implementation
```typescript
@Injectable()
export class ActivityService {
  async trackActivity(data: CreateActivityDto): Promise<Activity> {
    const activity = await this.prisma.activity.create({
      data: {
        ...data,
        score: this.calculateActivityScore(data),
      },
    });
    
    // Update contact's last activity
    await this.prisma.contact.update({
      where: { id: data.contactId },
      data: {
        lastActivityAt: new Date(),
        score: {
          increment: activity.score,
        },
      },
    });
    
    // Real-time notification
    await this.websocket.emit(`contact:${data.contactId}:activity`, activity);
    
    // Check for automation triggers
    await this.automationService.checkTriggers({
      type: 'ACTIVITY',
      activity,
    });
    
    return activity;
  }

  private calculateActivityScore(data: CreateActivityDto): number {
    const scores = {
      EMAIL_OPENED: 1,
      EMAIL_CLICKED: 3,
      EMAIL_REPLIED: 5,
      MEETING_SCHEDULED: 10,
      MEETING_ATTENDED: 15,
      DEAL_CREATED: 20,
      FORM_SUBMITTED: 8,
      DOCUMENT_VIEWED: 4,
      WEBSITE_VISIT: 2,
    };
    
    return scores[data.type] || 1;
  }
}
```

### 8. Data Quality Management (Days 19-20)

#### 8.1 Duplicate Detection & Merging
```typescript
@Injectable()
export class DuplicateDetectionService {
  async findDuplicates(contact: Partial<Contact>): Promise<DuplicateResult[]> {
    const candidates = await this.findCandidates(contact);
    const scored = [];
    
    for (const candidate of candidates) {
      const score = await this.calculateSimilarityScore(contact, candidate);
      if (score > 0.7) {
        scored.push({
          contact: candidate,
          score,
          matchedFields: this.getMatchedFields(contact, candidate),
        });
      }
    }
    
    return scored.sort((a, b) => b.score - a.score);
  }

  private async calculateSimilarityScore(
    contact1: Partial<Contact>,
    contact2: Contact
  ): Promise<number> {
    const weights = {
      email: 0.3,
      name: 0.2,
      phone: 0.15,
      company: 0.15,
      domain: 0.1,
      social: 0.1,
    };
    
    let score = 0;
    
    // Email similarity
    if (contact1.email && contact2.email) {
      score += weights.email * this.emailSimilarity(contact1.email, contact2.email);
    }
    
    // Name similarity
    if (contact1.firstName && contact2.firstName) {
      score += weights.name * this.stringSimilarity(
        `${contact1.firstName} ${contact1.lastName}`,
        `${contact2.firstName} ${contact2.lastName}`
      );
    }
    
    // Phone similarity
    if (contact1.phone && contact2.phone) {
      score += weights.phone * this.phoneSimilarity(contact1.phone, contact2.phone);
    }
    
    // Company similarity
    if (contact1.companyId && contact2.companyId) {
      score += weights.company * (contact1.companyId === contact2.companyId ? 1 : 0);
    }
    
    // AI-enhanced similarity
    const aiScore = await this.calculateAISimilarity(contact1, contact2);
    score = (score * 0.7) + (aiScore * 0.3);
    
    return score;
  }

  async mergeContacts(
    primaryId: string,
    secondaryIds: string[],
    strategy: MergeStrategy
  ): Promise<Contact> {
    const primary = await this.prisma.contact.findUnique({
      where: { id: primaryId },
      include: this.fullIncludes,
    });
    
    const secondaries = await this.prisma.contact.findMany({
      where: { id: { in: secondaryIds } },
      include: this.fullIncludes,
    });
    
    // Build merged data based on strategy
    const mergedData = await this.buildMergedData(primary, secondaries, strategy);
    
    // Update primary contact
    const merged = await this.prisma.$transaction(async (tx) => {
      // Update primary
      const updated = await tx.contact.update({
        where: { id: primaryId },
        data: mergedData,
      });
      
      // Transfer relationships
      await this.transferRelationships(tx, primaryId, secondaryIds);
      
      // Archive secondaries
      await tx.contact.updateMany({
        where: { id: { in: secondaryIds } },
        data: {
          isArchived: true,
          archivedReason: `Merged into ${primaryId}`,
        },
      });
      
      return updated;
    });
    
    // Re-index
    await this.elastic.index('contacts', merged);
    
    return merged;
  }
}
```

### 9. GraphQL API Implementation (Days 21)

#### 9.1 Comprehensive Contact API
```graphql
# Contact GraphQL Schema
type Contact {
  id: ID!
  email: String!
  emailVerified: Boolean!
  firstName: String
  lastName: String
  fullName: String
  phone: String
  
  # Professional
  title: String
  department: String
  seniority: Seniority
  
  # Company
  company: Company
  
  # Social
  linkedinUrl: String
  twitterHandle: String
  socialProfiles: [SocialProfile!]!
  
  # Metadata
  source: ContactSource!
  lifecycleStage: LifecycleStage!
  score: Int!
  temperature: Temperature!
  
  # Relationships
  owner: User
  activities(
    first: Int
    after: String
    filter: ActivityFilter
  ): ActivityConnection!
  
  # Custom fields
  customFields: [CustomFieldValue!]!
  
  # Tags
  tags: [Tag!]!
  
  # AI Insights
  insights: ContactInsights
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  lastActivityAt: DateTime
}

input ContactFilter {
  search: String
  email: StringFilter
  lifecycleStage: [LifecycleStage!]
  score: IntRange
  tags: [ID!]
  customFields: [CustomFieldFilter!]
  hasActivity: Boolean
  createdAt: DateRange
  lastActivityAt: DateRange
}

type Query {
  # Single contact
  contact(id: ID!): Contact
  
  # List with advanced filtering
  contacts(
    filter: ContactFilter
    orderBy: ContactOrderBy
    first: Int
    after: String
  ): ContactConnection!
  
  # Search with highlighting
  searchContacts(
    query: String!
    filters: ContactFilter
    limit: Int = 20
  ): ContactSearchResult!
  
  # Duplicate detection
  findDuplicateContacts(
    email: String
    name: String
    phone: String
  ): [DuplicateResult!]!
  
  # Smart lists
  evaluateSmartList(id: ID!): [Contact!]!
  
  # Export
  exportContacts(
    filter: ContactFilter
    fields: [String!]
    format: ExportFormat!
  ): ExportJob!
}

type Mutation {
  # CRUD operations
  createContact(input: CreateContactInput!): Contact!
  updateContact(id: ID!, input: UpdateContactInput!): Contact!
  deleteContact(id: ID!): Boolean!
  archiveContact(id: ID!): Contact!
  
  # Bulk operations
  bulkCreateContacts(input: BulkCreateInput!): BulkResult!
  bulkUpdateContacts(ids: [ID!]!, update: UpdateContactInput!): BulkResult!
  bulkDeleteContacts(ids: [ID!]!): BulkResult!
  
  # Import
  startContactImport(
    file: Upload!
    mapping: ImportMapping!
    options: ImportOptions!
  ): ImportJob!
  
  # Enrichment
  enrichContact(id: ID!, providers: [EnrichmentProvider!]): EnrichmentResult!
  enrichContactsBulk(ids: [ID!]!): EnrichmentJob!
  
  # Merging
  mergeContacts(
    primaryId: ID!
    secondaryIds: [ID!]!
    strategy: MergeStrategy!
  ): Contact!
  
  # Tags
  tagContacts(contactIds: [ID!]!, tagIds: [ID!]!): [Contact!]!
  untagContacts(contactIds: [ID!]!, tagIds: [ID!]!): [Contact!]!
  
  # Custom fields
  setCustomFieldValue(
    contactId: ID!
    fieldId: ID!
    value: JSON!
  ): Contact!
}

type Subscription {
  # Real-time updates
  contactUpdated(id: ID!): Contact!
  contactCreated(filter: ContactFilter): Contact!
  activityCreated(contactId: ID!): Activity!
  enrichmentCompleted(contactId: ID!): EnrichmentResult!
}
```

## ✅ Success Criteria

### Performance Metrics
- **Search Performance**: <100ms for 1M+ contacts
- **Import Speed**: >5,000 contacts/second
- **Enrichment Success**: >85% match rate
- **Duplicate Detection**: >95% accuracy
- **API Response Time**: <50ms p95

### Quality Metrics
- **Data Completeness**: >80% of contacts have 5+ fields
- **Email Deliverability**: >95% valid emails
- **Zero Data Loss**: During all operations
- **Test Coverage**: >90% for critical paths

### User Experience
- **Search Autocomplete**: <50ms response
- **Bulk Operations**: Visual progress indicators
- **Import Mapping**: Auto-detection >90% accurate
- **Real-time Updates**: <100ms latency

## 📊 Monitoring & Analytics

### Key Metrics to Track
```typescript
// Contact metrics
interface ContactMetrics {
  total: number;
  byLifecycleStage: Record<LifecycleStage, number>;
  bySource: Record<ContactSource, number>;
  averageScore: number;
  dataCompleteness: number;
  enrichmentCoverage: number;
  activeLastNDays: {
    7: number;
    30: number;
    90: number;
  };
}

// Performance metrics
interface PerformanceMetrics {
  searchLatency: Histogram;
  importThroughput: number;
  enrichmentQueueDepth: number;
  elasticsearchHealth: HealthStatus;
  apiResponseTimes: {
    p50: number;
    p95: number;
    p99: number;
  };
}
```

## 🚨 Common Issues & Solutions

### Issue: Slow Search Performance
**Solution**: 
- Optimize Elasticsearch mappings
- Add more specific indexes
- Implement search result caching
- Use filter context for non-scoring queries

### Issue: Import Memory Issues
**Solution**:
- Use streaming for large files
- Process in smaller batches
- Implement backpressure
- Use worker processes

### Issue: Duplicate False Positives
**Solution**:
- Tune similarity thresholds
- Add domain-specific rules
- Use AI for edge cases
- Implement manual review queue

## 📈 Optimization Tips

1. **Elasticsearch Optimization**
   - Use appropriate analyzers for each field
   - Implement search-as-you-type fields
   - Configure proper sharding strategy
   - Use index lifecycle management

2. **Import Performance**
   - Pre-validate data before processing
   - Use bulk APIs for database operations
   - Implement parallel processing
   - Cache lookup data

3. **Enrichment Efficiency**
   - Batch API requests when possible
   - Cache enrichment results
   - Prioritize high-value contacts
   - Use webhooks for real-time updates

## 🔒 Security Considerations

1. **Data Privacy**
   - Implement field-level encryption for PII
   - Audit log all data access
   - Support data anonymization
   - GDPR compliance tools

2. **API Security**
   - Rate limit by user and endpoint
   - Implement field-level permissions
   - Validate all input data
   - Sanitize export data

## 📚 Resources

### Documentation
- [Elasticsearch Best Practices](https://www.elastic.co/guide/en/elasticsearch/reference/current/best-practices.html)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)
- [GraphQL Schema Design](https://graphql.org/learn/schema/)
- [Import/Export Patterns](https://martinfowler.com/articles/patterns-of-data-movement.html)

### Internal Docs
- [Search Architecture](../architecture/search.md)
- [Data Model](../architecture/database-schema.md)
- [API Guidelines](../api/graphql-schema.md)
- [Testing Strategies](../development/testing-guide.md)

## ➡️ Next Phase

**Phase 3: Gmail Integration** - Building real-time email sync, tracking, and AI-powered email insights.

---

*Last Updated: 2024-01-15*  
*Documentation Version: 1.0*