# Backend Sync API Specification

This document describes the API endpoints that need to be implemented on your backend server for offline-first sync to work properly.

## Base URL
```
http://your-backend-server/api/v2
```

## Authentication
All endpoints require an Authorization header:
```
Authorization: Bearer {SYNC_API_KEY}
```

Set the environment variable `SYNC_API_KEY` on both the desktop app and server.

---

## 1. Pull Changes from Server

### Endpoint
```
POST /api/v2/sync/pull
```

### Request Body
```json
{
  "type": "Lead|EmailMessage|EmailThread",
  "since": 0,
  "deviceId": "unique-device-identifier"
}
```

### Response
```json
{
  "changes": [
    {
      "id": "lead-id-1",
      "operation": "CREATE|UPDATE|DELETE",
      "version": 5,
      "timestamp": "2025-02-25T10:30:00Z",
      "data": {
        "id": "lead-id-1",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "status": "CONTACTED",
        "createdAt": "2025-02-25T10:00:00Z",
        "updatedAt": "2025-02-25T10:30:00Z"
      },
      "hash": "sha256-hash-of-data"
    }
  ],
  "lastVersion": 10,
  "hasMore": false
}
```

### Notes
- Return changes where `version > since`
- Include pagination with `hasMore` flag if result set is large
- `data` field is required for CREATE/UPDATE, can be null for DELETE
- Return empty array if no new changes

---

## 2. Push Changes to Server

### Endpoint
```
POST /api/v2/sync/push
```

### Request Body
```json
{
  "batch": [
    {
      "id": "lead-id-1",
      "entityType": "Lead",
      "operation": "CREATE|UPDATE|DELETE",
      "data": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      }
    }
  ],
  "deviceId": "unique-device-identifier"
}
```

### Response
```json
{
  "accepted": ["lead-id-1", "lead-id-2"],
  "conflicts": [
    {
      "id": "lead-id-3",
      "entityType": "Lead",
      "localVersion": 2,
      "serverVersion": 5,
      "serverData": {
        "id": "lead-id-3",
        "firstName": "Jane",
        "status": "NEGOTIATION"
      },
      "serverTimestamp": "2025-02-25T09:15:00Z"
    }
  ],
  "errors": [
    {
      "id": "lead-id-4",
      "message": "Invalid lead data"
    }
  ]
}
```

### Notes
- Validate incoming data against your schema
- Increment version counter for all accepted changes
- Return conflicts if local version differs from server
- Store all changes in your audit log
- Device can retry with same batch multiple times (idempotent)

---

## 3. Resolve Conflicts

### Endpoint
```
POST /api/v2/conflicts/resolve
```

### Request Body
```json
{
  "conflicts": [
    {
      "id": "lead-id-3",
      "entityType": "Lead",
      "resolution": "ACCEPT_LOCAL|ACCEPT_SERVER|MERGE"
    }
  ]
}
```

### Response
```json
{
  "resolved": 1
}
```

### Notes
- ACCEPT_LOCAL: Keep local changes, discard server
- ACCEPT_SERVER: Discard local, keep server
- MERGE: Apply field-level merge (implement your own logic)

---

## 4. Get Sync Status

### Endpoint
```
GET /api/v2/sync/status
```

### Response
```json
{
  "deviceLastSync": "2025-02-25T10:30:00Z",
  "db_version": 125
}
```

---

## 5. Email Queue Endpoints

### Draft Email
```
POST /api/v2/email/queue/draft
```

Request:
```json
{
  "to": "recipient@example.com",
  "subject": "Subject",
  "body": "Email body",
  "cc": "optional@example.com",
  "bcc": "optional@example.com",
  "linkedLeadId": "lead-id",
  "attachments": ["file-path-1", "file-path-2"]
}
```

### Send Email
```
POST /api/v2/email/queue/send
```

Request:
```json
{
  "emailId": "email-queue-id"
}
```

### Get Pending Emails
```
GET /api/v2/email/queue/pending
```

Response:
```json
{
  "data": [
    {
      "id": "email-id",
      "to": "recipient@example.com",
      "subject": "Subject",
      "status": "QUEUED|FAILED",
      "createdAt": "2025-02-25T10:30:00Z"
    }
  ]
}
```

---

## 6. Sync Start Endpoint

### Endpoint
```
POST /api/v2/sync/start
```

### Response
```json
{
  "success": true,
  "message": "Sync initiated"
}
```

### Notes
- Triggers a full sync cycle on server
- Returns immediately (sync happens in background)
- Used by desktop app to request sync

---

## Implementation Checklist

- [ ] Implement GET /api/v2/sync/status
- [ ] Implement POST /api/v2/sync/pull
- [ ] Implement POST /api/v2/sync/push
- [ ] Implement POST /api/v2/conflicts/resolve
- [ ] Implement POST /api/v2/sync/start
- [ ] Add version tracking to all main entities (Lead, EmailMessage, EmailThread)
- [ ] Add device tracking and last sync timestamps
- [ ] Implement conflict detection logic
- [ ] Set up audit logging for all sync operations
- [ ] Add API key authentication

---

## Example Implementation (Node.js/Express)

```typescript
import { Router } from 'express';
import { prisma } from '@/lib/db';
import { checkApiKey } from '@/middleware/auth';

const router = Router();

// Pull changes
router.post('/sync/pull', checkApiKey, async (req, res) => {
  const { type, since, deviceId } = req.body;

  const changes = await prisma[type.toLowerCase()].findMany({
    where: {
      _version: { gt: since }
    },
    take: 50
  });

  res.json({
    changes,
    lastVersion: Math.max(...changes.map(c => c._version)),
    hasMore: changes.length === 50
  });
});

// Push changes
router.post('/sync/push', checkApiKey, async (req, res) => {
  const { batch, deviceId } = req.body;
  const accepted = [];
  const conflicts = [];
  const errors = [];

  for (const item of batch) {
    try {
      // Check for conflicts
      const existing = await prisma[item.entityType.toLowerCase()].findUnique({
        where: { id: item.id }
      });

      if (existing && existing._version > 0) {
        conflicts.push({
          id: item.id,
          entityType: item.entityType,
          serverVersion: existing._version,
          serverData: existing
        });
        continue;
      }

      // Create or update
      if (item.operation === 'CREATE') {
        await prisma[item.entityType.toLowerCase()].create({
          data: {
            ...item.data,
            _version: 1,
            _syncStatus: 'SYNCED'
          }
        });
      } else if (item.operation === 'UPDATE') {
        await prisma[item.entityType.toLowerCase()].update({
          where: { id: item.id },
          data: {
            ...item.data,
            _version: { increment: 1 },
            _syncStatus: 'SYNCED'
          }
        });
      }

      accepted.push(item.id);

      // Log audit
      await prisma.auditLog.create({
        data: {
          actionType: 'SYNC_' + item.operation,
          entityType: item.entityType,
          entityId: item.id,
          description: `Synced from device ${deviceId}`
        }
      });
    } catch (error) {
      errors.push({
        id: item.id,
        message: error.message
      });
    }
  }

  res.json({ accepted, conflicts, errors });
});

export default router;
```

---

## Version Requirements

- Node.js 16+
- Express 4.18+
- Prisma 5+
- SQLite 3+

---

## Environment Variables

```
SYNC_API_KEY=your-secure-api-key-here
SYNC_SERVER_URL=https://your-backend-server.com
DATABASE_PATH=/path/to/app.db
DEVICE_ID=desktop-client-1
```

---

## Testing

Use Postman or curl to test:

```bash
# Test pull
curl -X POST http://localhost:3000/api/v2/sync/pull \
  -H "Authorization: Bearer your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Lead",
    "since": 0,
    "deviceId": "desktop-1"
  }'

# Test push
curl -X POST http://localhost:3000/api/v2/sync/push \
  -H "Authorization: Bearer your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "batch": [{
      "id": "cuid-123",
      "entityType": "Lead",
      "operation": "CREATE",
      "data": {"firstName": "John", "email": "john@example.com"}
    }],
    "deviceId": "desktop-1"
  }'
```

---

## Status Codes

- `200`: Success
- `400`: Invalid request
- `401`: Unauthorized (invalid API key)
- `409`: Conflict detected
- `500`: Server error

---

## Rate Limiting

- 100 requests per minute per device
- Max batch size: 50 items per request
- Timeout: 30 seconds
