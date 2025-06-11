# WebSocket API Documentation

## Overview

The CRM WebSocket API provides real-time bidirectional communication for instant updates, live collaboration, and event streaming. Built on Socket.IO, it offers automatic reconnection, fallback transports, and room-based messaging.

## Connection

### Endpoint
```
wss://api.hastecrm.com/socket.io/
```

### Authentication
WebSocket connections require authentication via one of the following methods:

1. **JWT Token** (Recommended)
```javascript
const socket = io('wss://api.hastecrm.com', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

2. **API Key**
```javascript
const socket = io('wss://api.hastecrm.com', {
  auth: {
    apiKey: 'your-api-key'
  }
});
```

### Connection Options
```javascript
const socket = io('wss://api.hastecrm.com', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
  auth: {
    token: 'your-jwt-token'
  }
});
```

## Events

### Client to Server Events

#### subscribe
Subscribe to specific resource updates
```javascript
socket.emit('subscribe', {
  resource: 'contact',
  id: 'contact_123',
  events: ['update', 'delete']
});
```

#### unsubscribe
Unsubscribe from resource updates
```javascript
socket.emit('unsubscribe', {
  resource: 'contact',
  id: 'contact_123'
});
```

#### join-room
Join a collaboration room
```javascript
socket.emit('join-room', {
  type: 'pipeline',
  id: 'pipeline_456'
});
```

#### leave-room
Leave a collaboration room
```javascript
socket.emit('leave-room', {
  type: 'pipeline',
  id: 'pipeline_456'
});
```

#### ping
Keep connection alive
```javascript
socket.emit('ping');
```

### Server to Client Events

#### connected
Successful connection established
```javascript
socket.on('connected', (data) => {
  console.log('Connected:', data);
  // { sessionId: 'xxx', userId: 'yyy', timestamp: '2025-01-10T12:00:00Z' }
});
```

#### resource-update
Resource has been updated
```javascript
socket.on('resource-update', (data) => {
  console.log('Resource updated:', data);
  // {
  //   resource: 'contact',
  //   id: 'contact_123',
  //   action: 'update',
  //   data: { /* updated fields */ },
  //   timestamp: '2025-01-10T12:00:00Z',
  //   userId: 'user_who_made_change'
  // }
});
```

#### resource-delete
Resource has been deleted
```javascript
socket.on('resource-delete', (data) => {
  console.log('Resource deleted:', data);
  // {
  //   resource: 'contact',
  //   id: 'contact_123',
  //   timestamp: '2025-01-10T12:00:00Z',
  //   userId: 'user_who_deleted'
  // }
});
```

#### email-received
New email received
```javascript
socket.on('email-received', (data) => {
  console.log('Email received:', data);
  // {
  //   emailId: 'email_789',
  //   contactId: 'contact_123',
  //   subject: 'Re: Follow up',
  //   from: 'client@example.com',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

#### pipeline-update
Pipeline deal moved or updated
```javascript
socket.on('pipeline-update', (data) => {
  console.log('Pipeline updated:', data);
  // {
  //   pipelineId: 'pipeline_456',
  //   dealId: 'deal_789',
  //   previousStage: 'negotiation',
  //   newStage: 'closed-won',
  //   userId: 'user_123',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

#### notification
Real-time notification
```javascript
socket.on('notification', (data) => {
  console.log('Notification:', data);
  // {
  //   id: 'notif-123',
  //   type: 'mention',
  //   title: 'You were mentioned',
  //   message: 'John mentioned you in a comment',
  //   link: '/deals/deal_789',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

#### error
Error occurred
```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error);
  // {
  //   code: 'UNAUTHORIZED',
  //   message: 'Invalid authentication token',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

#### pong
Response to ping
```javascript
socket.on('pong', () => {
  console.log('Pong received');
});
```

## Room-Based Events

### Collaboration Rooms
Join rooms for real-time collaboration on specific resources.

#### user-joined
User joined a room
```javascript
socket.on('user-joined', (data) => {
  // {
  //   userId: 'user_456',
  //   userName: 'Jane Smith',
  //   roomType: 'pipeline',
  //   roomId: 'pipeline_123',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

#### user-left
User left a room
```javascript
socket.on('user-left', (data) => {
  // {
  //   userId: 'user_456',
  //   userName: 'Jane Smith',
  //   roomType: 'pipeline',
  //   roomId: 'pipeline_123',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

#### typing
User is typing (for comments/notes)
```javascript
socket.emit('typing', {
  roomType: 'contact',
  roomId: 'contact_123',
  field: 'notes'
});

socket.on('user-typing', (data) => {
  // {
  //   userId: 'user_456',
  //   userName: 'Jane Smith',
  //   field: 'notes',
  //   timestamp: '2025-01-10T12:00:00Z'
  // }
});
```

## Resource-Specific Subscriptions

### Contact Events
```javascript
// Subscribe to all contact events for a specific contact
socket.emit('subscribe', {
  resource: 'contact',
  id: 'contact_123',
  events: ['update', 'delete', 'activity', 'email', 'note']
});

// Subscribe to all contacts in an organization
socket.emit('subscribe', {
  resource: 'contact',
  filter: { organizationId: 'org-456' },
  events: ['create', 'update']
});
```

### Deal Events
```javascript
// Subscribe to deal updates
socket.emit('subscribe', {
  resource: 'deal',
  id: 'deal_789',
  events: ['update', 'stage-change', 'assignment', 'comment']
});

// Subscribe to all deals in a pipeline
socket.emit('subscribe', {
  resource: 'deal',
  filter: { pipelineId: 'pipeline_123' },
  events: ['create', 'stage-change']
});
```

### Email Events
```javascript
// Subscribe to email thread updates
socket.emit('subscribe', {
  resource: 'email-thread',
  id: 'thread_123',
  events: ['new-email', 'reply', 'forward']
});
```

## Error Handling

### Error Codes
- `UNAUTHORIZED`: Invalid or expired authentication
- `FORBIDDEN`: Insufficient permissions
- `INVALID_REQUEST`: Malformed request data
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMITED`: Too many requests
- `SERVER_ERROR`: Internal server error

### Error Response Format
```javascript
{
  code: 'ERROR_CODE',
  message: 'Human-readable error message',
  details: {}, // Optional additional error details
  timestamp: '2025-01-10T12:00:00Z'
}
```

## Rate Limiting

WebSocket connections are subject to the following limits:
- **Events per second**: 100 per client
- **Subscriptions**: 1000 active subscriptions per connection
- **Payload size**: 1MB per message

Exceeding limits will result in a `RATE_LIMITED` error and temporary throttling.

## Best Practices

### Connection Management
```javascript
// Handle connection events
socket.on('connect', () => {
  console.log('Connected to WebSocket');
  // Re-subscribe to resources after reconnection
  resubscribeToResources();
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Handle UI state for offline mode
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});
```

### Subscription Management
```javascript
// Track active subscriptions
const subscriptions = new Map();

function subscribeToResource(resource, id, events) {
  const key = `${resource}:${id}`;
  
  if (subscriptions.has(key)) {
    return; // Already subscribed
  }
  
  socket.emit('subscribe', { resource, id, events });
  subscriptions.set(key, { resource, id, events });
}

function unsubscribeFromResource(resource, id) {
  const key = `${resource}:${id}`;
  
  if (!subscriptions.has(key)) {
    return;
  }
  
  socket.emit('unsubscribe', { resource, id });
  subscriptions.delete(key);
}

// Clean up subscriptions on component unmount
function cleanup() {
  subscriptions.forEach(({ resource, id }) => {
    socket.emit('unsubscribe', { resource, id });
  });
  subscriptions.clear();
}
```

### Error Recovery
```javascript
socket.on('error', (error) => {
  switch (error.code) {
    case 'UNAUTHORIZED':
      // Refresh authentication token
      refreshAuthToken().then(token => {
        socket.auth.token = token;
        socket.connect();
      });
      break;
    
    case 'RATE_LIMITED':
      // Implement exponential backoff
      setTimeout(() => {
        retryLastAction();
      }, error.retryAfter || 5000);
      break;
    
    default:
      console.error('WebSocket error:', error);
  }
});
```

## Example Implementation

### React Hook
```javascript
import { useEffect, useCallback } from 'react';
import io from 'socket.io-client';

export function useWebSocket(token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const socketInstance = io('wss://api.hastecrm.com', {
      auth: { token }
    });
    
    socketInstance.on('connect', () => setConnected(true));
    socketInstance.on('disconnect', () => setConnected(false));
    
    setSocket(socketInstance);
    
    return () => {
      socketInstance.disconnect();
    };
  }, [token]);
  
  const subscribe = useCallback((resource, id, events) => {
    if (socket && connected) {
      socket.emit('subscribe', { resource, id, events });
    }
  }, [socket, connected]);
  
  const unsubscribe = useCallback((resource, id) => {
    if (socket && connected) {
      socket.emit('unsubscribe', { resource, id });
    }
  }, [socket, connected]);
  
  return { socket, connected, subscribe, unsubscribe };
}
```

### Usage Example
```javascript
function ContactDetails({ contactId }) {
  const { socket, subscribe, unsubscribe } = useWebSocket(authToken);
  
  useEffect(() => {
    // Subscribe to contact updates
    subscribe('contact', contactId, ['update', 'activity']);
    
    // Listen for updates
    const handleUpdate = (data) => {
      if (data.id === contactId) {
        // Update local state
        setContact(prev => ({ ...prev, ...data.data }));
      }
    };
    
    socket.on('resource-update', handleUpdate);
    
    // Cleanup
    return () => {
      unsubscribe('contact', contactId);
      socket.off('resource-update', handleUpdate);
    };
  }, [contactId, socket, subscribe, unsubscribe]);
  
  // Component render...
}
```

## Testing

### Connection Testing
```bash
# Test WebSocket connection
wscat -c wss://api.hastecrm.com/socket.io/ \
  -H "Authorization: Bearer your-jwt-token"
```

### Load Testing
Use Socket.IO client libraries to simulate multiple concurrent connections and test system performance under load.

## Troubleshooting

### Common Issues

1. **Connection Fails**
   - Verify authentication credentials
   - Check network connectivity
   - Ensure WebSocket protocol is not blocked

2. **Missing Events**
   - Confirm subscription is active
   - Check event name spelling
   - Verify permissions for resource

3. **Frequent Disconnections**
   - Check for network instability
   - Verify token expiration handling
   - Monitor rate limit violations

### Debug Mode
Enable debug logging:
```javascript
localStorage.debug = 'socket.io-client:*';
```