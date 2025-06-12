# MVP Features

## Core Features

### 1. Authentication & Workspaces
- JWT-based authentication
- Google OAuth login
- Multi-workspace support
- Role-based permissions (Admin, User, Viewer)

### 2. Contact Management
- Create, read, update, delete contacts
- Company associations
- Tags and custom fields
- Bulk import/export (CSV)
- Full-text search

### 3. Gmail Integration
- OAuth-based email sync
- Real-time updates via webhooks
- Email threading
- Attachment handling
- Send emails from the app

### 4. AI Features
- Email summarization
- Smart compose
- Contact enrichment
- Suggested responses
- Meeting notes extraction

### 5. Pipeline Management
- Custom pipelines and stages
- Drag-and-drop deal management
- Deal value tracking
- Pipeline analytics
- Activity timeline

## Technical Implementation

### Contact Model
```prisma
model Contact {
  id          String   @id @default(cuid())
  email       String?
  firstName   String?
  lastName    String?
  phone       String?
  company     Company? @relation(...)
  activities  Activity[]
  deals       Deal[]
  tags        Tag[]
}
```

### Gmail Sync Flow
1. User authorizes Gmail access
2. Set up Pub/Sub webhook
3. Receive real-time notifications
4. Fetch and store emails
5. Extract contacts automatically

### AI Integration
```typescript
// Email summarization
const summary = await ai.summarize(email.content);

// Smart compose
const suggestions = await ai.generateResponses(email);

// Contact enrichment
const enrichedData = await ai.enrichContact(email);
```

## User Interface

### Main Views
- **Dashboard**: Overview and insights
- **Contacts**: List and detail views
- **Inbox**: Unified email interface
- **Pipelines**: Kanban-style deal tracking
- **Settings**: Workspace and user management

### Key Components
```tsx
// Contact list with search
<ContactList 
  contacts={contacts}
  onSearch={handleSearch}
  onFilter={handleFilter}
/>

// Email composer with AI
<EmailComposer
  recipient={contact}
  aiSuggestions={true}
  templates={templates}
/>

// Pipeline board
<PipelineBoard
  pipeline={pipeline}
  deals={deals}
  onDragEnd={handleDragEnd}
/>
```

## API Endpoints

### GraphQL Queries
- `viewer` - Current user
- `contacts` - List contacts
- `emails` - List emails
- `pipelines` - List pipelines

### GraphQL Mutations
- `createContact`
- `updateContact`
- `sendEmail`
- `createDeal`
- `moveCard`

### REST Endpoints
- `POST /v1/files/upload`
- `POST /v1/contacts/import`
- `GET /v1/contacts/export`
- `POST /v1/webhooks/gmail`

## Feature Flags

Control feature rollout:
```env
FEATURE_AI_ENRICHMENT=true
FEATURE_EMAIL_TRACKING=true
FEATURE_BULK_OPERATIONS=true
```