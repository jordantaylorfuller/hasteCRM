# Phase 7: Meeting Intelligence

## Overview

Phase 7 implements AI-powered meeting intelligence with automatic recording, transcription, analysis, and actionable insights. This phase transforms meetings into searchable, actionable data that drives sales productivity and coaching.

## Core Features

### 1. Meeting Recording & Transcription

#### Recording Infrastructure
- Multi-platform support (Zoom, Teams, Google Meet, WebEx)
- Automatic recording triggers
- Cloud storage with encryption
- Compliance recording options

```typescript
interface MeetingRecording {
  id: string;
  meetingId: string;
  platform: 'zoom' | 'teams' | 'meet' | 'webex' | 'other';
  
  // Recording details
  recordingUrl: string;
  duration: number; // seconds
  fileSize: number; // bytes
  format: 'mp4' | 'webm' | 'mp3';
  
  // Participants
  participants: Participant[];
  host: string;
  
  // Status
  status: 'recording' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime: Date;
  
  // Metadata
  dealId?: string;
  contactIds: string[];
  companyId?: string;
  tags: string[];
}

interface Participant {
  id: string;
  name: string;
  email?: string;
  role: 'host' | 'presenter' | 'attendee';
  joinTime: Date;
  leaveTime: Date;
  talkTime: number; // seconds
}
```

#### Transcription Engine
- Real-time transcription
- Speaker diarization
- Multi-language support
- Custom vocabulary training

```typescript
interface Transcription {
  id: string;
  recordingId: string;
  
  // Content
  fullText: string;
  segments: TranscriptSegment[];
  
  // Quality
  confidence: number;
  language: string;
  duration: number;
  
  // Processing
  status: 'processing' | 'completed' | 'failed';
  processedAt: Date;
  revisedAt?: Date;
}

interface TranscriptSegment {
  speaker: string;
  speakerId: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  keywords?: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
}
```

### 2. AI-Powered Analysis

#### Meeting Summary
- Automatic summary generation
- Key points extraction
- Action items identification
- Decision tracking

```typescript
interface MeetingSummary {
  id: string;
  meetingId: string;
  
  // Summary sections
  overview: string;
  keyPoints: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  questions: Question[];
  
  // Topics
  topics: Topic[];
  mainTheme: string;
  
  // Sentiment
  overallSentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  
  // Next steps
  suggestedFollowUp: string;
  recommendedNextMeeting?: Date;
}

interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed';
  mentionedAt: number; // timestamp in recording
}

interface Decision {
  description: string;
  madeBy?: string;
  timestamp: number;
  impact: 'high' | 'medium' | 'low';
}
```

#### Conversation Intelligence
- Talk ratio analysis
- Engagement scoring
- Objection detection
- Competitor mentions
- Pricing discussions

```typescript
interface ConversationAnalytics {
  meetingId: string;
  
  // Participation
  talkRatio: {
    [participantId: string]: number; // percentage
  };
  
  // Engagement
  engagementScore: number; // 0-100
  interactionCount: number;
  questionCount: number;
  
  // Sales intelligence
  objections: Objection[];
  competitors: CompetitorMention[];
  pricingDiscussions: PricingDiscussion[];
  painPoints: string[];
  
  // Behavioral insights
  interruptions: number;
  silences: Silence[];
  monologues: Monologue[];
  
  // Coaching opportunities
  coachingInsights: CoachingInsight[];
}

interface Objection {
  text: string;
  timestamp: number;
  type: 'price' | 'timing' | 'feature' | 'competitor' | 'other';
  resolved: boolean;
  response?: string;
}
```

### 3. Searchable Meeting Library

#### Advanced Search
- Full-text search across transcripts
- Filter by participants, dates, topics
- Keyword highlighting
- Moment search with playback

```typescript
interface MeetingSearch {
  query: string;
  filters: {
    participants?: string[];
    dateRange?: DateRange;
    deals?: string[];
    companies?: string[];
    topics?: string[];
    hasActionItems?: boolean;
    sentiment?: string[];
  };
  
  results: SearchResult[];
}

interface SearchResult {
  meetingId: string;
  title: string;
  date: Date;
  relevanceScore: number;
  
  // Matched segments
  segments: {
    text: string;
    timestamp: number;
    speaker: string;
    matchedKeywords: string[];
  }[];
  
  // Quick insights
  duration: number;
  participantCount: number;
  actionItemCount: number;
}
```

### 4. Meeting Coaching

#### Performance Metrics
- Individual performance tracking
- Team benchmarks
- Improvement trends
- Best practice identification

```typescript
interface CoachingDashboard {
  userId: string;
  period: DateRange;
  
  // Performance metrics
  metrics: {
    meetingCount: number;
    avgTalkRatio: number;
    avgEngagementScore: number;
    objectionHandlingRate: number;
    followUpRate: number;
  };
  
  // Comparisons
  teamAverage: PerformanceMetrics;
  topPerformer: PerformanceMetrics;
  improvement: number; // percentage vs previous period
  
  // Insights
  strengths: string[];
  improvementAreas: string[];
  recommendations: CoachingRecommendation[];
  
  // Learning resources
  suggestedContent: LearningResource[];
}

interface CoachingRecommendation {
  area: 'questioning' | 'listening' | 'objection_handling' | 'closing' | 'rapport';
  currentLevel: number; // 1-10
  targetLevel: number;
  specificActions: string[];
  exampleClips: MeetingClip[];
}
```

### 5. Real-time Meeting Assistant

#### Live Insights
- Real-time transcription display
- Live coaching tips
- Battlecard suggestions
- Competitor mention alerts

```typescript
interface LiveMeetingAssistant {
  meetingId: string;
  
  // Real-time data
  currentSpeaker: string;
  talkTime: { [participant: string]: number };
  
  // Live suggestions
  suggestedQuestions: string[];
  relevantContent: Content[];
  battleCards: BattleCard[];
  
  // Alerts
  alerts: Alert[];
  
  // Notes
  autoNotes: string[];
  manualNotes: Note[];
}

interface Alert {
  type: 'competitor_mention' | 'objection' | 'buying_signal' | 'action_item';
  message: string;
  timestamp: Date;
  suggestedAction?: string;
}

interface BattleCard {
  trigger: string; // keyword or phrase
  title: string;
  content: string;
  talkingPoints: string[];
  resources: string[];
}
```

### 6. Integration Hub

#### CRM Integration
- Automatic activity logging
- Deal stage updates
- Contact engagement tracking
- Pipeline velocity impact

```typescript
interface MeetingCRMSync {
  meetingId: string;
  
  // Associations
  dealId?: string;
  contactIds: string[];
  companyId?: string;
  
  // Updates
  activityLog: Activity;
  dealUpdates?: DealUpdate[];
  contactUpdates?: ContactUpdate[];
  
  // Follow-up
  scheduledTasks: Task[];
  nextMeeting?: Meeting;
  
  // Insights sync
  dealHealth: 'improving' | 'stable' | 'at_risk';
  engagementTrend: 'increasing' | 'stable' | 'decreasing';
}
```

#### Calendar Integration
- Automatic meeting detection
- Participant enrichment
- Schedule optimization
- Follow-up scheduling

### 7. Analytics & Reporting

#### Meeting Analytics Dashboard
```typescript
interface MeetingAnalytics {
  period: DateRange;
  
  // Volume metrics
  totalMeetings: number;
  totalDuration: number;
  avgDuration: number;
  avgParticipants: number;
  
  // Outcome metrics
  positiveOutcomes: number;
  actionItemsGenerated: number;
  actionItemsCompleted: number;
  followUpRate: number;
  
  // Engagement metrics
  avgEngagementScore: number;
  avgTalkRatio: number;
  questionRate: number;
  
  // Trends
  meetingTrends: TrendData[];
  engagementTrends: TrendData[];
  outcomeTrends: TrendData[];
  
  // Top performers
  topPerformers: {
    byEngagement: User[];
    byOutcomes: User[];
    byImprovement: User[];
  };
}
```

## Technical Implementation

### Database Schema

#### Meetings Table
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  external_id VARCHAR(255), -- Platform meeting ID
  platform VARCHAR(20) NOT NULL,
  
  -- Basic info
  title VARCHAR(500),
  scheduled_start TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  duration INTEGER, -- seconds
  
  -- Associations
  organizer_id UUID REFERENCES users(id),
  deal_id UUID REFERENCES deals(id),
  company_id UUID REFERENCES companies(id),
  
  -- Recording
  recording_url TEXT,
  recording_status VARCHAR(20),
  
  -- Analysis
  summary_generated BOOLEAN DEFAULT false,
  analysis_completed BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Search
  search_vector tsvector
);

CREATE INDEX idx_meetings_workspace ON meetings(workspace_id);
CREATE INDEX idx_meetings_scheduled ON meetings(scheduled_start);
CREATE INDEX idx_meetings_deal ON meetings(deal_id);
CREATE INDEX idx_meetings_search ON meetings USING gin(search_vector);
```

#### Meeting Participants Table
```sql
CREATE TABLE meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Identity
  name VARCHAR(255),
  email VARCHAR(255),
  contact_id UUID REFERENCES contacts(id),
  user_id UUID REFERENCES users(id),
  
  -- Participation
  role VARCHAR(20), -- 'host', 'presenter', 'attendee'
  join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,
  talk_time INTEGER, -- seconds
  
  -- Analytics
  engagement_score DECIMAL(3,2),
  sentiment_score DECIMAL(3,2),
  
  PRIMARY KEY (meeting_id, email)
);

CREATE INDEX idx_participants_meeting ON meeting_participants(meeting_id);
CREATE INDEX idx_participants_contact ON meeting_participants(contact_id);
```

#### Transcriptions Table
```sql
CREATE TABLE transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Content
  full_text TEXT,
  language VARCHAR(10) DEFAULT 'en',
  confidence DECIMAL(3,2),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Revisions
  revision_count INTEGER DEFAULT 0,
  last_revised_at TIMESTAMPTZ,
  revised_by UUID REFERENCES users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transcriptions_meeting ON transcriptions(meeting_id);
CREATE INDEX idx_transcriptions_fulltext ON transcriptions USING gin(to_tsvector('english', full_text));
```

#### Transcript Segments Table
```sql
CREATE TABLE transcript_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcription_id UUID NOT NULL REFERENCES transcriptions(id) ON DELETE CASCADE,
  
  -- Content
  speaker_id VARCHAR(50),
  speaker_name VARCHAR(255),
  text TEXT,
  
  -- Timing
  start_time DECIMAL(10,3),
  end_time DECIMAL(10,3),
  
  -- Analysis
  confidence DECIMAL(3,2),
  sentiment VARCHAR(10),
  keywords TEXT[],
  
  -- Order
  segment_index INTEGER NOT NULL
);

CREATE INDEX idx_segments_transcription ON transcript_segments(transcription_id);
CREATE INDEX idx_segments_speaker ON transcript_segments(speaker_id);
CREATE INDEX idx_segments_keywords ON transcript_segments USING gin(keywords);
```

#### Meeting Summaries Table
```sql
CREATE TABLE meeting_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Summary content
  overview TEXT,
  key_points TEXT[],
  main_topics TEXT[],
  
  -- Sentiment
  overall_sentiment VARCHAR(10),
  sentiment_score DECIMAL(3,2),
  
  -- Recommendations
  suggested_follow_up TEXT,
  recommended_next_meeting DATE,
  
  -- Generation info
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_version VARCHAR(20),
  
  UNIQUE(meeting_id)
);

CREATE INDEX idx_summaries_meeting ON meeting_summaries(meeting_id);
```

#### Action Items Table
```sql
CREATE TABLE meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Content
  description TEXT NOT NULL,
  assignee_id UUID REFERENCES users(id),
  due_date DATE,
  priority VARCHAR(10) DEFAULT 'medium',
  
  -- Tracking
  status VARCHAR(20) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  
  -- Context
  mentioned_at DECIMAL(10,3), -- timestamp in recording
  transcript_segment_id UUID REFERENCES transcript_segments(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_action_items_meeting ON meeting_action_items(meeting_id);
CREATE INDEX idx_action_items_assignee ON meeting_action_items(assignee_id);
CREATE INDEX idx_action_items_status ON meeting_action_items(status);
```

### API Endpoints

#### Meeting Management
```typescript
// Meeting CRUD
GET    /api/v1/meetings
POST   /api/v1/meetings
GET    /api/v1/meetings/:id
PUT    /api/v1/meetings/:id
DELETE /api/v1/meetings/:id

// Recording management
POST   /api/v1/meetings/:id/record
GET    /api/v1/meetings/:id/recording
POST   /api/v1/meetings/:id/upload-recording

// Transcription
GET    /api/v1/meetings/:id/transcript
POST   /api/v1/meetings/:id/transcribe
PUT    /api/v1/meetings/:id/transcript/revise

// Analysis
GET    /api/v1/meetings/:id/summary
POST   /api/v1/meetings/:id/analyze
GET    /api/v1/meetings/:id/insights
```

#### Search & Intelligence
```typescript
// Search
POST   /api/v1/meetings/search
GET    /api/v1/meetings/search/suggestions

// Intelligence
GET    /api/v1/meetings/:id/coaching-insights
GET    /api/v1/meetings/:id/conversation-analytics
GET    /api/v1/meetings/:id/action-items

// Real-time
ws://  /api/v1/meetings/:id/live
POST   /api/v1/meetings/:id/live/note
```

#### Analytics & Reporting
```typescript
// Analytics
GET    /api/v1/analytics/meetings
GET    /api/v1/analytics/meeting-trends
GET    /api/v1/analytics/coaching-metrics

// Reports
GET    /api/v1/reports/meeting-performance
GET    /api/v1/reports/team-coaching
GET    /api/v1/reports/engagement-analysis
```

### Processing Pipeline

```typescript
class MeetingProcessingPipeline {
  async processMeeting(meetingId: string) {
    // 1. Fetch recording
    const recording = await this.fetchRecording(meetingId);
    
    // 2. Transcribe audio
    const transcription = await this.transcribeAudio(recording);
    
    // 3. Speaker diarization
    const segments = await this.identifySpeakers(transcription);
    
    // 4. Generate summary
    const summary = await this.generateSummary(segments);
    
    // 5. Extract insights
    const insights = await this.extractInsights(segments, summary);
    
    // 6. Identify action items
    const actionItems = await this.extractActionItems(segments);
    
    // 7. Calculate analytics
    const analytics = await this.calculateAnalytics(segments);
    
    // 8. Update CRM
    await this.syncToCRM(meetingId, summary, actionItems);
    
    // 9. Send notifications
    await this.sendNotifications(meetingId, actionItems);
  }
}
```

### AI Models Integration

```typescript
interface AIService {
  // Transcription
  transcribe(audio: AudioFile): Promise<Transcription>;
  
  // Analysis
  summarize(transcript: string): Promise<Summary>;
  extractActionItems(transcript: string): Promise<ActionItem[]>;
  analyzeSentiment(text: string): Promise<SentimentAnalysis>;
  identifyTopics(transcript: string): Promise<Topic[]>;
  
  // Real-time
  suggestQuestions(context: string): Promise<string[]>;
  detectObjections(text: string): Promise<Objection[]>;
  generateBattleCard(topic: string): Promise<BattleCard>;
}
```

## Frontend Components

### Meeting Dashboard
```typescript
interface MeetingDashboardProps {
  meetings: Meeting[];
  filters: MeetingFilters;
  onFilterChange: (filters: MeetingFilters) => void;
  onMeetingClick: (meetingId: string) => void;
}

const MeetingDashboard: React.FC<MeetingDashboardProps> = ({
  meetings,
  filters,
  onFilterChange,
  onMeetingClick
}) => {
  // Meeting list with thumbnails
  // Filter sidebar
  // Search bar
  // Analytics summary cards
};
```

### Meeting Player
```typescript
interface MeetingPlayerProps {
  meeting: Meeting;
  transcript: Transcription;
  onSegmentClick: (timestamp: number) => void;
}

const MeetingPlayer: React.FC<MeetingPlayerProps> = ({
  meeting,
  transcript,
  onSegmentClick
}) => {
  // Video/audio player
  // Synchronized transcript
  // Speaker timeline
  // Action items sidebar
  // Search within meeting
};
```

### Live Meeting Assistant
```typescript
interface LiveAssistantProps {
  meetingId: string;
  userId: string;
}

const LiveMeetingAssistant: React.FC<LiveAssistantProps> = ({
  meetingId,
  userId
}) => {
  // Real-time transcript
  // Talk time tracker
  // Suggested questions
  // Battle cards
  // Note taking
};
```

## Performance Optimization

### Processing Optimization
- Parallel transcription processing
- Chunked audio processing
- GPU acceleration for AI models
- Caching transcription results

### Storage Optimization
```typescript
// Tiered storage strategy
class MeetingStorage {
  async storeRecording(recording: Recording) {
    if (recording.age < 30) {
      // Hot storage - SSD
      await this.hotStorage.store(recording);
    } else if (recording.age < 180) {
      // Warm storage - HDD
      await this.warmStorage.store(recording);
    } else {
      // Cold storage - S3 Glacier
      await this.coldStorage.store(recording);
    }
  }
}
```

### Search Optimization
- Full-text search indexes
- Elasticsearch integration
- Query result caching
- Segment-level indexing

## Security & Compliance

### Data Security
- End-to-end encryption for recordings
- Secure transcription processing
- Access control per meeting
- Audit trail for all access

### Compliance
- GDPR compliance for recordings
- Consent management
- Data retention policies
- Right to deletion

### Privacy Controls
```typescript
interface PrivacySettings {
  // Recording consent
  requireExplicitConsent: boolean;
  consentMessage: string;
  
  // Data retention
  recordingRetentionDays: number;
  transcriptRetentionDays: number;
  
  // Access control
  restrictAccessToParticipants: boolean;
  allowGuestAccess: boolean;
  
  // Redaction
  autoRedactPII: boolean;
  redactedFields: string[];
}
```

## Testing Strategy

### Unit Tests
- Transcription accuracy
- Summary generation
- Action item extraction
- Analytics calculations

### Integration Tests
- Platform integrations
- AI model integration
- CRM synchronization
- Search functionality

### Performance Tests
- Transcription speed
- Search performance
- Concurrent processing
- Storage efficiency

## Deployment Checklist

- [ ] Platform integrations configured
- [ ] AI models deployed
- [ ] Storage infrastructure ready
- [ ] Processing pipeline tested
- [ ] Security measures implemented
- [ ] Search indexes created
- [ ] Analytics dashboards ready
- [ ] Coaching features enabled
- [ ] Documentation complete
- [ ] Team training delivered

## Success Metrics

- Transcription accuracy > 95%
- Processing time < 2x meeting duration
- Search response time < 500ms
- Action item extraction accuracy > 90%
- User adoption rate > 80%
- Coaching improvement score > 20%

## Future Enhancements

### Phase 7.1
- Multi-language support
- Custom vocabulary training
- Advanced coaching AI
- Predictive meeting outcomes

### Phase 7.2
- VR meeting support
- Emotion detection
- Body language analysis
- Competitive intelligence

### Phase 7.3
- Automated meeting scheduling
- AI meeting facilitator
- Real-time translation
- Meeting effectiveness scoring