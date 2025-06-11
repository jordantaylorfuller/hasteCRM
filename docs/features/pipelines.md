# Pipeline Management

## Table of Contents
1. [Overview](#overview)
2. [Pipeline Types](#pipeline-types)
3. [Pipeline Architecture](#pipeline-architecture)
4. [Stage Configuration](#stage-configuration)
5. [Deal Management](#deal-management)
6. [Automation Rules](#automation-rules)
7. [Pipeline Analytics](#pipeline-analytics)
8. [AI-Powered Features](#ai-powered-features)
9. [Multi-Pipeline Strategies](#multi-pipeline-strategies)
10. [Performance Optimization](#performance-optimization)
11. [Best Practices](#best-practices)
12. [Advanced Features](#advanced-features)

## Overview

The Pipeline Management system is a flexible, AI-enhanced framework for managing any multi-stage process - from sales opportunities to recruitment, investor relations, and custom workflows. Unlike traditional CRMs that focus solely on sales, our system adapts to any business process requiring stage-based progression tracking.

### Key Features
- **Multiple Pipeline Types**: Sales, recruitment, investor, vendor, and custom pipelines
- **AI-Powered Insights**: Predictive analytics, deal scoring, and next best actions
- **Visual Pipeline Builder**: Drag-and-drop interface for creating custom stages
- **Automation Engine**: Trigger actions based on stage changes and conditions
- **Advanced Analytics**: Revenue forecasting, velocity tracking, and conversion analysis
- **Real-time Collaboration**: Team visibility and activity tracking

## Pipeline Types

### Built-in Pipeline Templates

#### Sales Pipeline
```typescript
interface SalesPipeline {
  type: 'sales';
  stages: [
    { name: 'Lead', probability: 10 },
    { name: 'Qualified', probability: 20 },
    { name: 'Demo', probability: 40 },
    { name: 'Proposal', probability: 60 },
    { name: 'Negotiation', probability: 80 },
    { name: 'Closed Won', probability: 100 },
    { name: 'Closed Lost', probability: 0 }
  ];
  metrics: {
    averageDealSize: number;
    conversionRate: number;
    averageCycleTime: number;
    winRate: number;
  };
}
```

#### Recruitment Pipeline
```typescript
interface RecruitmentPipeline {
  type: 'recruitment';
  stages: [
    { name: 'Applied', probability: 10 },
    { name: 'Screening', probability: 25 },
    { name: 'Phone Interview', probability: 40 },
    { name: 'Technical Assessment', probability: 60 },
    { name: 'Final Interview', probability: 80 },
    { name: 'Offer', probability: 90 },
    { name: 'Hired', probability: 100 },
    { name: 'Rejected', probability: 0 }
  ];
  metrics: {
    timeToHire: number;
    offerAcceptanceRate: number;
    sourcingEffectiveness: Record<string, number>;
    candidateQualityScore: number;
  };
}
```

#### Investor Pipeline
```typescript
interface InvestorPipeline {
  type: 'investor';
  stages: [
    { name: 'Prospecting', probability: 5 },
    { name: 'Initial Contact', probability: 15 },
    { name: 'First Meeting', probability: 30 },
    { name: 'Due Diligence', probability: 50 },
    { name: 'Term Sheet', probability: 75 },
    { name: 'Closing', probability: 90 },
    { name: 'Funded', probability: 100 },
    { name: 'Passed', probability: 0 }
  ];
  metrics: {
    fundingAmount: number;
    investorEngagementScore: number;
    daysToClose: number;
    termSheetConversionRate: number;
  };
}
```

### Custom Pipeline Creation
```typescript
mutation CreateCustomPipeline($input: CreatePipelineInput!) {
  createPipeline(input: $input) {
    id
    name
    type
    stages {
      id
      name
      order
      probability
      color
      automationRules {
        id
        trigger
        actions
      }
    }
  }
}

// Example: Customer Success Pipeline
{
  "input": {
    "name": "Customer Success Journey",
    "type": "custom",
    "description": "Track customer onboarding and success milestones",
    "stages": [
      {
        "name": "Trial",
        "order": 1,
        "probability": 20,
        "color": "#FFB800"
      },
      {
        "name": "Onboarding",
        "order": 2,
        "probability": 40,
        "color": "#36B37E"
      },
      {
        "name": "Active User",
        "order": 3,
        "probability": 70,
        "color": "#00B8D9"
      },
      {
        "name": "Power User",
        "order": 4,
        "probability": 90,
        "color": "#6554C0"
      },
      {
        "name": "Champion",
        "order": 5,
        "probability": 100,
        "color": "#FF5630"
      }
    ]
  }
}
```

## Pipeline Architecture

### Database Schema
```typescript
interface Pipeline {
  id: string;
  workspaceId: string;
  
  // Basic info
  name: string;
  type: PipelineType;
  description?: string;
  
  // Settings
  currency: string;
  probabilityEnabled: boolean;
  rottingEnabled: boolean;
  rottingDays: number;
  
  // Permissions
  visibility: 'everyone' | 'team' | 'owner';
  
  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

interface PipelineStage {
  id: string;
  pipelineId: string;
  
  // Stage info
  name: string;
  orderIndex: number;
  probability: number; // 0-100
  
  // Visual
  color: string;
  icon?: string;
  
  // Automation
  automationRules: AutomationRule[];
  requiredFields?: string[];
  
  // Settings
  rottenAfterDays?: number;
  winStage: boolean;
  lostStage: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

interface Deal {
  id: string;
  workspaceId: string;
  
  // Basic info
  title: string;
  value: number;
  currency: string;
  
  // Pipeline position
  pipelineId: string;
  stageId: string;
  stageOrder: number; // Position within stage
  
  // Relationships
  contactId?: string;
  companyId?: string;
  ownerId: string;
  
  // Deal details
  probability: number;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  
  // Status
  status: 'open' | 'won' | 'lost';
  wonReason?: string;
  lostReason?: string;
  lostCompetitor?: string;
  
  // Tracking
  stageEnteredAt: Date;
  lastActivityAt?: Date;
  rottingDays: number;
  
  // AI insights
  aiScore?: number;
  aiInsights?: DealAIInsights;
  aiPredictedCloseDate?: Date;
  aiPredictedValue?: number;
  
  // Custom fields
  customFields: Record<string, any>;
  
  // Metadata
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

### Deal Stage History
```typescript
interface DealHistory {
  id: string;
  dealId: string;
  
  // Change details
  fieldName: string;
  oldValue: any;
  newValue: any;
  
  // Stage changes
  fromStageId?: string;
  toStageId?: string;
  timeInStage?: number; // milliseconds
  
  // User info
  changedBy: string;
  changedAt: Date;
  
  // Context
  note?: string;
  automationTriggered?: boolean;
}
```

## Stage Configuration

### Visual Pipeline Builder
```typescript
interface PipelineBuilderConfig {
  // Drag and drop support
  allowReorder: boolean;
  allowAddStage: boolean;
  allowRemoveStage: boolean;
  
  // Stage customization
  customColors: string[];
  customIcons: string[];
  
  // Validation
  minStages: number;
  maxStages: number;
  requireWinStage: boolean;
  requireLostStage: boolean;
}

// Stage operations
mutation UpdateStageOrder($pipelineId: ID!, $stages: [StageOrderInput!]!) {
  updateStageOrder(pipelineId: $pipelineId, stages: $stages) {
    id
    stages {
      id
      name
      orderIndex
    }
  }
}

mutation UpdateStageSettings($stageId: ID!, $input: UpdateStageInput!) {
  updateStage(id: $stageId, input: $input) {
    id
    name
    probability
    color
    automationRules {
      id
      enabled
    }
  }
}
```

### Stage Automation Rules
```typescript
interface AutomationRule {
  id: string;
  stageId: string;
  
  // Trigger conditions
  trigger: {
    type: 'enter_stage' | 'exit_stage' | 'time_in_stage' | 'field_change';
    conditions?: Condition[];
    delay?: number; // milliseconds
  };
  
  // Actions to perform
  actions: Action[];
  
  // Settings
  enabled: boolean;
  priority: number;
  continueOnError: boolean;
  
  // Execution tracking
  lastExecutedAt?: Date;
  executionCount: number;
}

interface Action {
  type: ActionType;
  config: Record<string, any>;
}

enum ActionType {
  SEND_EMAIL = 'send_email',
  CREATE_TASK = 'create_task',
  UPDATE_FIELD = 'update_field',
  NOTIFY_USER = 'notify_user',
  WEBHOOK = 'webhook',
  ASSIGN_OWNER = 'assign_owner',
  ADD_TAG = 'add_tag',
  MOVE_STAGE = 'move_stage',
  CREATE_ACTIVITY = 'create_activity'
}

// Example: Automation for proposal stage
{
  "trigger": {
    "type": "enter_stage",
    "conditions": [
      {
        "field": "value",
        "operator": "greater_than",
        "value": 10000
      }
    ]
  },
  "actions": [
    {
      "type": "send_email",
      "config": {
        "template": "high_value_proposal",
        "to": ["{{owner.email}}", "{{manager.email}}"]
      }
    },
    {
      "type": "create_task",
      "config": {
        "title": "Schedule proposal review with {{contact.name}}",
        "dueIn": "2 days",
        "assignTo": "{{owner.id}}"
      }
    },
    {
      "type": "update_field",
      "config": {
        "field": "priority",
        "value": "high"
      }
    }
  ]
}
```

## Deal Management

### Deal Creation
```typescript
mutation CreateDeal($input: CreateDealInput!) {
  createDeal(input: $input) {
    id
    title
    value
    stage {
      id
      name
    }
    probability
    expectedCloseDate
    owner {
      id
      name
    }
    aiInsights {
      score
      predictedCloseDate
      recommendations
    }
  }
}

// Example with AI enrichment
{
  "input": {
    "title": "Enterprise License - Acme Corp",
    "pipelineId": "pipeline_sales_001",
    "stageId": "stage_qualified",
    "value": 50000,
    "contactId": "contact_123",
    "companyId": "company_456",
    "expectedCloseDate": "2024-03-31",
    "customFields": {
      "dealType": "new_business",
      "competitors": ["Competitor A", "Competitor B"],
      "decisionCriteria": ["Price", "Features", "Support"]
    }
  }
}
```

### Deal Movement
```typescript
mutation MoveDealToStage($dealId: ID!, $stageId: ID!, $reason: String) {
  moveDealToStage(dealId: $dealId, stageId: $stageId, reason: $reason) {
    id
    stage {
      id
      name
    }
    stageHistory {
      fromStage
      toStage
      timeInStage
      movedAt
      movedBy
    }
    automationResults {
      triggered
      actions
      success
    }
  }
}

// Bulk operations
mutation BulkMoveDeal($dealIds: [ID!]!, $stageId: ID!) {
  bulkMoveDeals(dealIds: $dealIds, stageId: $stageId) {
    successful
    failed {
      dealId
      error
    }
  }
}
```

### Deal Queries
```typescript
query GetPipelineView($pipelineId: ID!, $filters: DealFilters) {
  pipeline(id: $pipelineId) {
    id
    name
    stages {
      id
      name
      color
      deals(filters: $filters) {
        nodes {
          id
          title
          value
          company {
            name
          }
          owner {
            name
            avatar
          }
          rottingDays
          lastActivityAt
          aiScore
        }
        totalValue
        count
      }
    }
    analytics {
      totalValue
      averageDealSize
      conversionRate
      velocity
    }
  }
}

// Advanced filtering
{
  "filters": {
    "owners": ["user_123", "user_456"],
    "valueRange": { "min": 10000, "max": 100000 },
    "createdAfter": "2024-01-01",
    "tags": ["enterprise", "priority"],
    "rotting": true,
    "customFields": {
      "region": "North America"
    }
  }
}
```

## Automation Rules

### Automation Engine
```typescript
class PipelineAutomationEngine {
  async executeRules(deal: Deal, event: AutomationEvent) {
    const stage = await getStage(deal.stageId);
    const rules = stage.automationRules.filter(r => 
      r.enabled && r.trigger.type === event.type
    );
    
    // Sort by priority
    rules.sort((a, b) => b.priority - a.priority);
    
    for (const rule of rules) {
      if (await this.evaluateConditions(rule.conditions, deal)) {
        await this.executeActions(rule.actions, deal, event);
      }
    }
  }
  
  async evaluateConditions(conditions: Condition[], deal: Deal): Promise<boolean> {
    for (const condition of conditions) {
      const value = this.getFieldValue(deal, condition.field);
      
      if (!this.evaluateCondition(value, condition.operator, condition.value)) {
        return false;
      }
    }
    
    return true;
  }
  
  async executeActions(actions: Action[], deal: Deal, event: AutomationEvent) {
    const results = [];
    
    for (const action of actions) {
      try {
        const result = await this.executeAction(action, deal, event);
        results.push({ action: action.type, success: true, result });
      } catch (error) {
        results.push({ action: action.type, success: false, error: error.message });
        
        if (!action.continueOnError) {
          throw error;
        }
      }
    }
    
    // Log automation execution
    await this.logExecution(deal.id, event, results);
    
    return results;
  }
}
```

### Common Automation Patterns

#### Lead Routing
```typescript
{
  "name": "Round-robin lead assignment",
  "trigger": {
    "type": "enter_stage",
    "stage": "Lead"
  },
  "conditions": [
    {
      "field": "owner",
      "operator": "is_empty"
    }
  ],
  "actions": [
    {
      "type": "assign_owner",
      "config": {
        "method": "round_robin",
        "users": ["user_1", "user_2", "user_3"],
        "considerWorkload": true,
        "considerTimezone": true
      }
    }
  ]
}
```

#### Deal Rotting Alert
```typescript
{
  "name": "Deal rotting notification",
  "trigger": {
    "type": "time_in_stage",
    "days": 14
  },
  "conditions": [
    {
      "field": "status",
      "operator": "equals",
      "value": "open"
    }
  ],
  "actions": [
    {
      "type": "notify_user",
      "config": {
        "recipients": ["{{owner.id}}", "{{owner.manager.id}}"],
        "message": "Deal '{{deal.title}}' has been in {{stage.name}} for 14 days",
        "priority": "high"
      }
    },
    {
      "type": "create_task",
      "config": {
        "title": "Follow up on stalled deal: {{deal.title}}",
        "description": "This deal has been inactive. Please update or move to appropriate stage.",
        "assignTo": "{{owner.id}}",
        "dueIn": "1 day"
      }
    }
  ]
}
```

#### Win/Loss Analysis
```typescript
{
  "name": "Capture win/loss reasons",
  "trigger": {
    "type": "enter_stage",
    "stages": ["Closed Won", "Closed Lost"]
  },
  "actions": [
    {
      "type": "show_form",
      "config": {
        "form": "win_loss_analysis",
        "required": true,
        "fields": [
          {
            "name": "primary_reason",
            "type": "select",
            "options": ["Price", "Features", "Competition", "Timing", "Budget"]
          },
          {
            "name": "competitor",
            "type": "text",
            "condition": "stage === 'Closed Lost'"
          },
          {
            "name": "lessons_learned",
            "type": "textarea"
          }
        ]
      }
    },
    {
      "type": "create_activity",
      "config": {
        "type": "deal_closed",
        "title": "Deal {{deal.status}}: {{deal.title}}",
        "metadata": {
          "value": "{{deal.value}}",
          "reason": "{{form.primary_reason}}",
          "competitor": "{{form.competitor}}"
        }
      }
    }
  ]
}
```

## Pipeline Analytics

### Key Metrics
```typescript
interface PipelineAnalytics {
  // Volume metrics
  totalDeals: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  
  // Value metrics
  totalPipelineValue: number;
  weightedPipelineValue: number;
  averageDealSize: number;
  medianDealSize: number;
  
  // Conversion metrics
  overallConversionRate: number;
  stageConversionRates: StageConversion[];
  winRate: number;
  lossReasons: Record<string, number>;
  
  // Velocity metrics
  averageSalesCycle: number; // days
  stageVelocity: StageVelocity[];
  bottlenecks: Bottleneck[];
  
  // Forecast
  forecastedRevenue: ForecastData;
  dealMomentum: MomentumScore;
  
  // Team performance
  performanceByOwner: OwnerPerformance[];
  performanceBySource: SourcePerformance[];
}

interface StageConversion {
  fromStage: string;
  toStage: string;
  conversionRate: number;
  averageTimeInStage: number;
  dropOffRate: number;
}

interface ForecastData {
  period: 'month' | 'quarter' | 'year';
  committed: number; // High probability deals
  bestCase: number; // All open deals
  mostLikely: number; // Weighted by probability
  aiPredicted: number; // ML prediction
  confidence: number; // 0-100
}
```

### Analytics Queries
```typescript
query GetPipelineAnalytics($pipelineId: ID!, $dateRange: DateRange!) {
  pipelineAnalytics(pipelineId: $pipelineId, dateRange: $dateRange) {
    # Conversion funnel
    conversionFunnel {
      stage
      entered
      exited
      conversionRate
      averageTime
    }
    
    # Revenue metrics
    revenue {
      total
      byStage {
        stage
        value
        weighted
      }
      forecast {
        month
        committed
        bestCase
        mostLikely
        aiPredicted
      }
    }
    
    # Velocity analysis
    velocity {
      averageCycleTime
      byStage {
        stage
        averageDays
        median
        trend
      }
      bottlenecks {
        stage
        impact
        recommendations
      }
    }
    
    # Win/loss analysis
    winLoss {
      winRate
      lossReasons {
        reason
        count
        percentage
      }
      competitorAnalysis {
        competitor
        wins
        losses
        winRate
      }
    }
    
    # Team performance
    teamPerformance {
      owner {
        id
        name
      }
      metrics {
        dealsOwned
        dealsWon
        revenue
        winRate
        averageDealSize
        averageCycleTime
      }
    }
  }
}
```

### Real-time Dashboard
```typescript
subscription PipelineDashboard($pipelineId: ID!) {
  pipelineDashboard(pipelineId: $pipelineId) {
    # Live deal movements
    dealMovements {
      deal {
        id
        title
        value
      }
      fromStage
      toStage
      movedBy
      timestamp
    }
    
    # Updated metrics
    metrics {
      totalValue
      dealsInProgress
      dealsClosedToday
      revenueToday
    }
    
    # Activity feed
    activities {
      type
      description
      user
      timestamp
    }
    
    # AI insights
    insights {
      type
      message
      priority
      actionRequired
    }
  }
}
```

## AI-Powered Features

### Deal Scoring
```typescript
interface DealAIInsights {
  // Overall score
  score: number; // 0-100
  scoreFactors: ScoreFactor[];
  
  // Predictions
  predictedCloseDate: Date;
  predictedValue: number;
  winProbability: number;
  
  // Risk analysis
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[];
  
  // Recommendations
  nextBestAction: ActionRecommendation;
  suggestedActivities: Activity[];
  
  // Insights
  dealVelocity: 'fast' | 'normal' | 'slow';
  engagementLevel: 'high' | 'medium' | 'low';
  competitivePosition: 'strong' | 'neutral' | 'weak';
}

interface ScoreFactor {
  factor: string;
  impact: number; // -100 to 100
  description: string;
}

// AI scoring implementation
class DealScoringService {
  async scoreDeal(deal: Deal): Promise<number> {
    const factors = [
      this.scoreEngagement(deal),
      this.scoreValue(deal),
      this.scoreVelocity(deal),
      this.scoreRelationships(deal),
      this.scoreCompleteness(deal),
      this.scoreHistoricalPatterns(deal)
    ];
    
    const weightedScore = factors.reduce((sum, factor) => 
      sum + (factor.score * factor.weight), 0
    );
    
    return Math.round(weightedScore);
  }
  
  private async scoreEngagement(deal: Deal) {
    const recentActivities = await getRecentActivities(deal.id);
    const emailEngagement = await getEmailEngagement(deal.contactId);
    const meetingFrequency = await getMeetingFrequency(deal.id);
    
    return {
      score: calculateEngagementScore(recentActivities, emailEngagement, meetingFrequency),
      weight: 0.25
    };
  }
}
```

### Predictive Analytics
```typescript
// Revenue forecasting
interface RevenueForecasting {
  async forecastRevenue(pipelineId: string, period: Period): Promise<Forecast> {
    const deals = await getOpenDeals(pipelineId);
    
    // Historical conversion rates
    const historicalRates = await getHistoricalConversionRates(pipelineId);
    
    // ML prediction
    const mlPrediction = await this.mlModel.predict({
      deals,
      historicalRates,
      seasonality: await getSeasonalityFactors(period),
      marketConditions: await getMarketConditions()
    });
    
    return {
      committed: this.calculateCommitted(deals),
      bestCase: this.calculateBestCase(deals),
      mostLikely: this.calculateMostLikely(deals, historicalRates),
      aiPredicted: mlPrediction.value,
      confidence: mlPrediction.confidence,
      factors: mlPrediction.factors
    };
  }
}

// Deal velocity prediction
interface VelocityPrediction {
  predictTimeToClose(deal: Deal): Promise<{
    estimatedDays: number;
    confidence: number;
    factors: VelocityFactor[];
  }> {
    const features = await this.extractFeatures(deal);
    const prediction = await this.velocityModel.predict(features);
    
    return {
      estimatedDays: prediction.days,
      confidence: prediction.confidence,
      factors: [
        { name: 'Deal size', impact: prediction.factors.dealSize },
        { name: 'Stage velocity', impact: prediction.factors.stageVelocity },
        { name: 'Engagement level', impact: prediction.factors.engagement },
        { name: 'Historical patterns', impact: prediction.factors.historical }
      ]
    };
  }
}
```

### Smart Recommendations
```typescript
// Next best action recommendations
class NextBestActionEngine {
  async getRecommendations(deal: Deal): Promise<ActionRecommendation[]> {
    const context = await this.gatherContext(deal);
    const patterns = await this.analyzeSuccessfulDeals(deal);
    
    const recommendations = [];
    
    // Check for missing activities
    if (!context.recentMeeting && deal.stage.name === 'Proposal') {
      recommendations.push({
        priority: 'high',
        action: 'schedule_meeting',
        title: 'Schedule proposal review meeting',
        reason: 'Deals in proposal stage with meetings close 40% faster',
        impact: { metric: 'velocity', improvement: '40%' }
      });
    }
    
    // Check for stakeholder engagement
    if (context.stakeholderCount < patterns.avgStakeholders) {
      recommendations.push({
        priority: 'medium',
        action: 'expand_relationships',
        title: 'Identify additional stakeholders',
        reason: `Successful deals typically involve ${patterns.avgStakeholders} stakeholders`,
        impact: { metric: 'win_rate', improvement: '25%' }
      });
    }
    
    // Check for competitive intelligence
    if (!deal.customFields.competitors && deal.value > 50000) {
      recommendations.push({
        priority: 'medium',
        action: 'gather_intelligence',
        title: 'Document competitive landscape',
        reason: 'Understanding competition improves win rate by 30%',
        impact: { metric: 'win_rate', improvement: '30%' }
      });
    }
    
    return recommendations;
  }
}
```

## Multi-Pipeline Strategies

### Cross-Pipeline Analytics
```typescript
query GetCrossPipelineInsights($workspaceId: ID!) {
  crossPipelineAnalytics(workspaceId: $workspaceId) {
    # Revenue across all pipelines
    totalRevenue {
      byPipeline {
        pipeline
        revenue
        percentage
      }
      trend
      forecast
    }
    
    # Resource allocation
    resourceAllocation {
      byOwner {
        owner
        dealsAcrossPipelines {
          pipeline
          count
          value
        }
        utilization
      }
    }
    
    # Pipeline health scores
    pipelineHealth {
      pipeline
      healthScore
      metrics {
        velocity
        conversionRate
        dealRotting
        forecastAccuracy
      }
    }
    
    # Opportunity insights
    opportunities {
      underperformingPipelines {
        pipeline
        issue
        recommendation
      }
      crossSellOpportunities {
        fromPipeline
        toPipeline
        potential
      }
    }
  }
}
```

### Pipeline Templates
```typescript
// Industry-specific templates
const pipelineTemplates = {
  saas: {
    name: "SaaS Sales Pipeline",
    stages: [
      { name: "Trial Started", probability: 10 },
      { name: "Qualified Trial", probability: 25 },
      { name: "Demo Completed", probability: 40 },
      { name: "Proposal Sent", probability: 60 },
      { name: "Contract Negotiation", probability: 80 },
      { name: "Closed Won", probability: 100 },
      { name: "Closed Lost", probability: 0 }
    ],
    customFields: [
      { name: "mrr", type: "currency", required: true },
      { name: "seats", type: "number", required: true },
      { name: "contractLength", type: "select", options: ["Monthly", "Annual", "Multi-year"] }
    ]
  },
  
  realEstate: {
    name: "Real Estate Pipeline",
    stages: [
      { name: "Lead", probability: 5 },
      { name: "Showing Scheduled", probability: 20 },
      { name: "Property Shown", probability: 35 },
      { name: "Offer Submitted", probability: 60 },
      { name: "Under Contract", probability: 85 },
      { name: "Closed", probability: 100 },
      { name: "Lost", probability: 0 }
    ],
    customFields: [
      { name: "propertyType", type: "select", options: ["Residential", "Commercial", "Land"] },
      { name: "listingPrice", type: "currency", required: true },
      { name: "commission", type: "percentage", required: true }
    ]
  }
};
```

## Performance Optimization

### Database Optimization
```sql
-- Indexes for pipeline queries
CREATE INDEX idx_deals_pipeline_stage ON deals(pipeline_id, stage_id, status);
CREATE INDEX idx_deals_owner_status ON deals(owner_id, status);
CREATE INDEX idx_deals_expected_close ON deals(expected_close_date) WHERE status = 'open';
CREATE INDEX idx_deals_value ON deals(workspace_id, value DESC);

-- Materialized view for pipeline analytics
CREATE MATERIALIZED VIEW pipeline_analytics_mv AS
SELECT 
  p.id as pipeline_id,
  p.workspace_id,
  COUNT(DISTINCT d.id) as total_deals,
  COUNT(DISTINCT CASE WHEN d.status = 'won' THEN d.id END) as won_deals,
  SUM(CASE WHEN d.status = 'open' THEN d.value ELSE 0 END) as pipeline_value,
  SUM(CASE WHEN d.status = 'won' THEN d.value ELSE 0 END) as won_value,
  AVG(CASE WHEN d.status = 'won' THEN d.value END) as avg_deal_size,
  AVG(
    CASE WHEN d.status = 'won' 
    THEN EXTRACT(EPOCH FROM (d.actual_close_date - d.created_at)) / 86400 
    END
  ) as avg_sales_cycle
FROM pipelines p
LEFT JOIN deals d ON p.id = d.pipeline_id
GROUP BY p.id, p.workspace_id;

CREATE INDEX idx_pipeline_analytics_mv ON pipeline_analytics_mv(pipeline_id);
```

### Caching Strategy
```typescript
// Pipeline view caching
const pipelineCache = {
  key: (pipelineId: string, filters: any) => 
    `pipeline:${pipelineId}:${hash(filters)}`,
  ttl: 60, // 1 minute for active pipelines
  
  async get(pipelineId: string, filters: any) {
    const key = this.key(pipelineId, filters);
    const cached = await redis.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    const data = await fetchPipelineData(pipelineId, filters);
    await redis.setex(key, this.ttl, JSON.stringify(data));
    
    return data;
  },
  
  async invalidate(pipelineId: string) {
    const pattern = `pipeline:${pipelineId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length) {
      await redis.del(...keys);
    }
  }
};

// Deal movement optimization
class DealMoveOptimizer {
  async batchMove(moves: DealMove[]) {
    // Group by pipeline for cache invalidation
    const pipelineGroups = groupBy(moves, 'pipelineId');
    
    // Execute moves in transaction
    await prisma.$transaction(async (tx) => {
      for (const move of moves) {
        await tx.deal.update({
          where: { id: move.dealId },
          data: {
            stageId: move.toStageId,
            stageEnteredAt: new Date(),
            stageOrder: move.order
          }
        });
        
        await tx.dealHistory.create({
          data: {
            dealId: move.dealId,
            fromStageId: move.fromStageId,
            toStageId: move.toStageId,
            changedBy: move.userId,
            timeInStage: move.timeInStage
          }
        });
      }
    });
    
    // Invalidate caches
    for (const pipelineId of Object.keys(pipelineGroups)) {
      await pipelineCache.invalidate(pipelineId);
    }
  }
}
```

### Real-time Updates
```typescript
// WebSocket updates for pipeline view
class PipelineRealtimeService {
  async notifyDealUpdate(deal: Deal, event: DealEvent) {
    const channel = `pipeline:${deal.pipelineId}`;
    
    await this.pubsub.publish(channel, {
      event: event.type,
      data: {
        dealId: deal.id,
        fromStageId: event.fromStageId,
        toStageId: event.toStageId,
        value: deal.value,
        updatedBy: event.userId,
        timestamp: new Date()
      }
    });
  }
  
  subscribeToUpdates(pipelineId: string) {
    return this.pubsub.subscribe(`pipeline:${pipelineId}`);
  }
}
```

## Best Practices

### Pipeline Design
1. **Keep It Simple**: 5-7 stages optimal for most pipelines
2. **Clear Stage Names**: Use action-oriented names
3. **Logical Progression**: Each stage should represent clear progress
4. **Define Exit Criteria**: Clear requirements for stage advancement
5. **Consistent Probability**: Align probability with historical data

### Deal Management
1. **Regular Updates**: Update deals at least weekly
2. **Accurate Data**: Keep deal values and close dates current
3. **Complete Information**: Fill all required fields
4. **Activity Logging**: Record all customer interactions
5. **Team Collaboration**: Use @mentions and comments

### Automation Best Practices
1. **Start Simple**: Begin with basic automations
2. **Test Thoroughly**: Test rules before enabling
3. **Monitor Results**: Track automation effectiveness
4. **Avoid Loops**: Prevent circular automation triggers
5. **Document Rules**: Maintain automation documentation

### Analytics & Reporting
```typescript
// Weekly pipeline review template
const weeklyReviewMetrics = {
  movement: {
    dealsAdvanced: number,
    dealsStalled: number,
    dealsLost: number,
    dealsWon: number
  },
  health: {
    rottingDeals: Deal[],
    missingActivities: Deal[],
    overdueCloses: Deal[]
  },
  forecast: {
    thisMonth: number,
    nextMonth: number,
    quarter: number,
    confidence: number
  },
  actions: {
    required: ActionItem[],
    completed: ActionItem[],
    overdue: ActionItem[]
  }
};
```

## Advanced Features

### AI-Powered Pipeline Optimization
```typescript
class PipelineOptimizer {
  async analyzePipeline(pipelineId: string): Promise<OptimizationReport> {
    const data = await this.gatherPipelineData(pipelineId);
    
    return {
      stageOptimization: await this.optimizeStages(data),
      automationSuggestions: await this.suggestAutomations(data),
      processImprovements: await this.identifyBottlenecks(data),
      aiRecommendations: await this.generateAIRecommendations(data)
    };
  }
  
  private async optimizeStages(data: PipelineData) {
    // Analyze conversion rates between stages
    const conversions = await this.calculateStageConversions(data);
    
    // Identify problem stages
    const problemStages = conversions.filter(c => c.rate < 0.5);
    
    // Generate recommendations
    return problemStages.map(stage => ({
      stage: stage.name,
      issue: `Low conversion rate: ${stage.rate * 100}%`,
      recommendations: [
        'Review stage requirements',
        'Analyze lost deal reasons',
        'Implement stage-specific training'
      ]
    }));
  }
}
```

### Custom Metrics & KPIs
```typescript
interface CustomMetric {
  id: string;
  name: string;
  description: string;
  formula: string; // e.g., "won_deals / total_deals * 100"
  unit: 'percentage' | 'currency' | 'number' | 'days';
  target?: number;
  
  // Calculation
  aggregation: 'sum' | 'average' | 'median' | 'count';
  filters?: MetricFilter[];
  groupBy?: string[];
  
  // Display
  visualization: 'number' | 'chart' | 'gauge' | 'trend';
  color: string;
  icon: string;
}

// Example: Sales velocity metric
{
  "name": "Sales Velocity",
  "description": "Revenue generated per day",
  "formula": "(opportunities * deal_value * win_rate) / sales_cycle_length",
  "unit": "currency",
  "target": 50000,
  "visualization": "trend",
  "alerts": [
    {
      "condition": "value < target * 0.8",
      "message": "Sales velocity below target",
      "severity": "warning"
    }
  ]
}
```

### Integration Capabilities
```typescript
// Slack integration for deal updates
const slackIntegration = {
  notifyDealWon: async (deal: Deal) => {
    await slack.postMessage({
      channel: '#sales-wins',
      text: `<� Deal Won: ${deal.title}`,
      attachments: [{
        color: 'good',
        fields: [
          { title: 'Value', value: formatCurrency(deal.value), short: true },
          { title: 'Owner', value: deal.owner.name, short: true },
          { title: 'Close Date', value: formatDate(deal.actualCloseDate), short: true },
          { title: 'Sales Cycle', value: `${deal.salesCycleDays} days`, short: true }
        ]
      }]
    });
  },
  
  notifyStageChange: async (deal: Deal, fromStage: string, toStage: string) => {
    await slack.postMessage({
      channel: deal.owner.slackId,
      text: `Deal "${deal.title}" moved from ${fromStage} to ${toStage}`
    });
  }
};
```

## Related Documentation

- [Deal API Reference](../api/deals.md)
- [Automation Engine](../features/automation.md)
- [Analytics Dashboard](../features/analytics.md)
- [AI Scoring](../features/ai-integration.md#deal-scoring)
- [Pipeline Templates](../templates/pipelines.md)

---

*Platform Version: 1.0.0*  
*Last Updated: 2024-01-15*