# Webhooks Documentation

## Overview

Webhooks allow your application to receive real-time notifications when events occur in the CRM. Instead of polling for changes, webhooks push data to your endpoint as events happen, enabling immediate reactions to CRM activities.

## Webhook Management

### Creating a Webhook

**POST** `/api/v1/webhooks`

```json
{
  "url": "https://your-app.com/webhooks/crm",
  "events": ["contact.created", "contact.updated", "deal.stage_changed"],
  "secret": "your-webhook-secret-here",
  "active": true,
  "description": "Production webhook for contact and deal events"
}
```

**Response**
```json
{
  "id": "webhook_123",
  "url": "https://your-app.com/webhooks/crm",
  "events": ["contact.created", "contact.updated", "deal.stage_changed"],
  "secret": "wh_sec_...",
  "active": true,
  "description": "Production webhook for contact and deal events",
  "createdAt": "2025-01-10T12:00:00Z",
  "lastTriggeredAt": null,
  "failureCount": 0
}
```

### Listing Webhooks

**GET** `/api/v1/webhooks`

```json
{
  "webhooks": [
    {
      "id": "webhook_123",
      "url": "https://your-app.com/webhooks/crm",
      "events": ["contact.created", "contact.updated"],
      "active": true,
      "createdAt": "2025-01-10T12:00:00Z",
      "lastTriggeredAt": "2025-01-10T14:30:00Z",
      "failureCount": 0
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "perPage": 20
  }
}
```

### Updating a Webhook

**PUT** `/api/v1/webhooks/{webhookId}`

```json
{
  "url": "https://your-app.com/webhooks/crm-v2",
  "events": ["contact.created", "contact.updated", "contact.deleted"],
  "active": true
}
```

### Deleting a Webhook

**DELETE** `/api/v1/webhooks/{webhookId}`

### Testing a Webhook

**POST** `/api/v1/webhooks/{webhookId}/test`

Sends a test payload to verify your endpoint is working correctly.

## Webhook Events

### Contact Events

#### contact.created
Triggered when a new contact is created
```json
{
  "event": "contact.created",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "contact_123",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp",
    "phone": "+1-555-0123",
    "createdAt": "2025-01-10T12:00:00Z",
    "createdBy": "user_456"
  }
}
```

#### contact.updated
Triggered when a contact is updated
```json
{
  "event": "contact.updated",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "contact_123",
    "changes": {
      "phone": {
        "old": "+1-555-0123",
        "new": "+1-555-0124"
      },
      "company": {
        "old": "Acme Corp",
        "new": "Acme Corporation"
      }
    },
    "updatedBy": "user_456"
  }
}
```

#### contact.deleted
Triggered when a contact is deleted
```json
{
  "event": "contact.deleted",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "contact_123",
    "deletedBy": "user_456"
  }
}
```

#### contact.merged
Triggered when contacts are merged
```json
{
  "event": "contact.merged",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "primaryId": "contact_123",
    "mergedIds": ["contact_456", "contact_789"],
    "mergedBy": "user_456"
  }
}
```

### Deal Events

#### deal.created
Triggered when a new deal is created
```json
{
  "event": "deal.created",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "deal_123",
    "name": "Enterprise License - Acme Corp",
    "value": 50000,
    "currency": "USD",
    "stage": "qualification",
    "pipelineId": "pipeline_456",
    "contactIds": ["contact_123"],
    "ownerId": "user_456",
    "createdAt": "2025-01-10T12:00:00Z"
  }
}
```

#### deal.updated
Triggered when a deal is updated
```json
{
  "event": "deal.updated",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "deal_123",
    "changes": {
      "value": {
        "old": 50000,
        "new": 75000
      },
      "probability": {
        "old": 20,
        "new": 40
      }
    },
    "updatedBy": "user_456"
  }
}
```

#### deal.stage_changed
Triggered when a deal moves to a different stage
```json
{
  "event": "deal.stage_changed",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "deal_123",
    "previousStage": "qualification",
    "newStage": "proposal",
    "pipelineId": "pipeline_456",
    "movedBy": "user_456",
    "stageChangedAt": "2025-01-10T12:00:00Z"
  }
}
```

#### deal.won
Triggered when a deal is marked as won
```json
{
  "event": "deal.won",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "deal_123",
    "value": 75000,
    "currency": "USD",
    "closedAt": "2025-01-10T12:00:00Z",
    "closedBy": "user_456"
  }
}
```

#### deal.lost
Triggered when a deal is marked as lost
```json
{
  "event": "deal.lost",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "deal_123",
    "lostReason": "Budget constraints",
    "closedAt": "2025-01-10T12:00:00Z",
    "closedBy": "user_456"
  }
}
```

### Email Events

#### email.received
Triggered when an email is received
```json
{
  "event": "email.received",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "email_123",
    "threadId": "thread_456",
    "from": "client@example.com",
    "to": ["sales@yourcompany.com"],
    "subject": "Re: Product Demo",
    "snippet": "Thanks for the demo. I have a few questions...",
    "contactId": "contact_123",
    "receivedAt": "2025-01-10T12:00:00Z"
  }
}
```

#### email.sent
Triggered when an email is sent
```json
{
  "event": "email.sent",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "email_456",
    "threadId": "thread_456",
    "to": ["client@example.com"],
    "subject": "Re: Product Demo",
    "contactId": "contact_123",
    "sentBy": "user_456",
    "sentAt": "2025-01-10T12:00:00Z"
  }
}
```

#### email.bounced
Triggered when an email bounces
```json
{
  "event": "email.bounced",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "email_456",
    "recipient": "client@example.com",
    "bounceType": "hard",
    "bounceReason": "Invalid email address",
    "contactId": "contact_123"
  }
}
```

### Activity Events

#### activity.created
Triggered when an activity is logged
```json
{
  "event": "activity.created",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "activity_123",
    "type": "call",
    "subject": "Discovery call",
    "duration": 1800,
    "contactIds": ["contact_123"],
    "dealId": "deal_456",
    "createdBy": "user_456",
    "activityDate": "2025-01-10T10:00:00Z"
  }
}
```

#### meeting.scheduled
Triggered when a meeting is scheduled
```json
{
  "event": "meeting.scheduled",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "meeting_123",
    "title": "Product Demo",
    "startTime": "2025-01-12T15:00:00Z",
    "endTime": "2025-01-12T16:00:00Z",
    "attendees": ["contact_123", "contact_456"],
    "dealId": "deal_789",
    "scheduledBy": "user_456"
  }
}
```

### Task Events

#### task.created
Triggered when a task is created
```json
{
  "event": "task.created",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "task_123",
    "title": "Follow up with John",
    "dueDate": "2025-01-11T17:00:00Z",
    "priority": "high",
    "assignedTo": "user_456",
    "contactId": "contact_123",
    "dealId": "deal_789"
  }
}
```

#### task.completed
Triggered when a task is completed
```json
{
  "event": "task.completed",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "task_123",
    "completedBy": "user_456",
    "completedAt": "2025-01-10T12:00:00Z"
  }
}
```

## Webhook Security

### Signature Verification

All webhook payloads include a signature header for verification:

**Headers**
```
X-Webhook-Signature: sha256=3b24c5b8a9d0e2f1...
X-Webhook-Timestamp: 1641825600
X-Webhook-Event: contact.created
```

**Verification Example (Node.js)**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, timestamp, secret) {
  // Prevent replay attacks (5 minute window)
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - parseInt(timestamp) > 300) {
    throw new Error('Webhook timestamp too old');
  }
  
  // Verify signature
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  const actualSignature = signature.replace('sha256=', '');
  
  if (actualSignature !== expectedSignature) {
    throw new Error('Invalid webhook signature');
  }
  
  return true;
}

// Express.js middleware
app.post('/webhooks/crm', (req, res) => {
  try {
    verifyWebhookSignature(
      req.body,
      req.headers['x-webhook-signature'],
      req.headers['x-webhook-timestamp'],
      process.env.WEBHOOK_SECRET
    );
    
    // Process webhook
    console.log('Webhook verified:', req.headers['x-webhook-event']);
    
    // Acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook verification failed:', error);
    res.status(401).send('Unauthorized');
  }
});
```

### IP Whitelisting

Webhook requests originate from these IP addresses:
- `52.89.214.238`
- `34.212.75.30`
- `54.218.53.128`

Configure your firewall to allow traffic from these IPs.

## Delivery & Retry Policy

### Delivery Attempts

Webhooks are delivered with the following retry policy:
- Initial attempt: Immediate
- 1st retry: 1 minute later
- 2nd retry: 5 minutes later
- 3rd retry: 30 minutes later
- 4th retry: 2 hours later
- 5th retry: 6 hours later

### Success Criteria

A webhook delivery is considered successful if:
- HTTP status code is 2xx (200-299)
- Response is received within 10 seconds

### Failure Handling

After 5 failed attempts:
- Webhook is marked as failing
- Email notification sent to webhook owner
- Webhook is automatically disabled after 3 consecutive days of failures

### Webhook Status Monitoring

**GET** `/api/v1/webhooks/{webhookId}/deliveries`

```json
{
  "deliveries": [
    {
      "id": "delivery_123",
      "event": "contact.created",
      "status": "success",
      "statusCode": 200,
      "attempts": 1,
      "responseTime": 234,
      "deliveredAt": "2025-01-10T12:00:00Z"
    },
    {
      "id": "delivery_456",
      "event": "deal.updated",
      "status": "failed",
      "statusCode": 500,
      "attempts": 5,
      "lastError": "Internal Server Error",
      "lastAttemptAt": "2025-01-10T18:00:00Z"
    }
  ]
}
```

## Best Practices

### Endpoint Implementation

1. **Acknowledge Quickly**
   - Return 200 OK immediately
   - Process webhook asynchronously
   ```javascript
   app.post('/webhooks', (req, res) => {
     // Acknowledge receipt
     res.status(200).send('OK');
     
     // Process async
     processWebhookAsync(req.body);
   });
   ```

2. **Idempotency**
   - Handle duplicate deliveries gracefully
   - Use event IDs to track processed events
   ```javascript
   async function processWebhook(event) {
     const eventId = event.id;
     
     // Check if already processed
     if (await isEventProcessed(eventId)) {
       console.log('Event already processed:', eventId);
       return;
     }
     
     // Process event
     await handleEvent(event);
     
     // Mark as processed
     await markEventProcessed(eventId);
   }
   ```

3. **Error Handling**
   - Log failures for debugging
   - Implement proper error recovery
   ```javascript
   async function processWebhookAsync(payload) {
     try {
       await processWebhook(payload);
     } catch (error) {
       console.error('Webhook processing failed:', error);
       await queueForRetry(payload);
     }
   }
   ```

### Security Best Practices

1. **Always Verify Signatures**
   - Never trust webhook data without verification
   - Use constant-time comparison for signatures

2. **Use HTTPS**
   - Only register HTTPS endpoints
   - Ensure valid SSL certificates

3. **Limit Access**
   - Restrict webhook endpoints to POST only
   - Implement rate limiting

4. **Rotate Secrets**
   - Regularly rotate webhook secrets
   - Support multiple active secrets during rotation

### Monitoring & Debugging

1. **Log All Webhooks**
   ```javascript
   function logWebhook(event, status, error = null) {
     console.log({
       timestamp: new Date().toISOString(),
       event: event.event,
       eventId: event.id,
       status,
       error: error?.message
     });
   }
   ```

2. **Monitor Webhook Health**
   - Track success/failure rates
   - Alert on repeated failures
   - Monitor response times

3. **Testing Webhooks**
   - Use webhook testing tools
   - Implement test mode
   - Log raw payloads during development

## Development Tools

### Webhook CLI

Test webhooks locally using our CLI:
```bash
# Install CLI
npm install -g @hastecrm/webhook-cli

# Forward webhooks to local server
hastecrm-webhooks forward --to http://localhost:3000/webhooks

# List recent webhook events
hastecrm-webhooks events list

# Replay specific event
hastecrm-webhooks events replay event_123
```

### Webhook Inspector

View webhook deliveries in the dashboard:
1. Navigate to Settings � Webhooks
2. Click on a webhook
3. View delivery history and payloads
4. Retry failed deliveries manually

## Example Implementations

### Node.js/Express
```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/webhooks/crm', async (req, res) => {
  // Verify signature
  if (!verifySignature(req)) {
    return res.status(401).send('Unauthorized');
  }
  
  // Acknowledge receipt
  res.status(200).send('OK');
  
  // Process event
  const event = req.body;
  
  switch (event.event) {
    case 'contact.created':
      await handleContactCreated(event.data);
      break;
    case 'deal.stage_changed':
      await handleDealStageChange(event.data);
      break;
    // ... handle other events
  }
});

function verifySignature(req) {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const secret = process.env.WEBHOOK_SECRET;
  
  const payload = JSON.stringify(req.body);
  const message = `${timestamp}.${payload}`;
  
  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')}`;
  
  return signature === expectedSignature;
}
```

### Python/Flask
```python
import hmac
import hashlib
import json
from flask import Flask, request, abort

app = Flask(__name__)

@app.route('/webhooks/crm', methods=['POST'])
def handle_webhook():
    # Verify signature
    if not verify_signature(request):
        abort(401)
    
    # Process event
    event = request.json
    
    if event['event'] == 'contact.created':
        handle_contact_created(event['data'])
    elif event['event'] == 'deal.stage_changed':
        handle_deal_stage_change(event['data'])
    
    return 'OK', 200

def verify_signature(request):
    signature = request.headers.get('X-Webhook-Signature')
    timestamp = request.headers.get('X-Webhook-Timestamp')
    secret = os.environ['WEBHOOK_SECRET']
    
    message = f"{timestamp}.{request.data.decode()}"
    expected_signature = f"sha256={hmac.new(
        secret.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()}"
    
    return hmac.compare_digest(signature, expected_signature)
```

## Troubleshooting

### Common Issues

1. **Webhook Not Receiving Events**
   - Verify webhook is active
   - Check event subscriptions
   - Confirm endpoint is accessible
   - Review firewall/security group rules

2. **Signature Verification Failing**
   - Ensure secret matches exactly
   - Check timestamp validation window
   - Verify payload serialization matches

3. **Duplicate Events**
   - Implement idempotency using event IDs
   - Check for multiple webhook registrations
   - Review retry policy understanding

4. **Performance Issues**
   - Process webhooks asynchronously
   - Implement queue system for high volume
   - Consider batching for bulk operations

## API Rate Limits

Webhook endpoints are subject to:
- 10,000 webhook deliveries per hour
- 100 webhook endpoints per account
- 50 events per webhook configuration

Contact support for higher limits.