# Email Integration Setup Guide

This guide will help you set up Gmail and Outlook email synchronization with real-time updates.

## Quick Start

You need to configure OAuth credentials for Gmail and/or Outlook. Here's what to do:

---

## 1. Gmail Setup

### Step 1.1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing one)
3. Enable the **Gmail API**:
   - Go to APIs & Services > Library
   - Search for "Gmail API"
   - Click "Enable"

### Step 1.2: Create OAuth 2.0 Credentials
1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/oauth/google/callback` (for local dev)
   - `https://yourdomain.com/api/oauth/google/callback` (for production)
5. Copy the Client ID and Client Secret

### Step 1.3: Update .env File
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback
```

### Step 1.4: (Optional) Enable Real-Time Push Notifications
For real-time email syncing without polling:

1. In Google Cloud Console > APIs & Services > Credentials
2. Create a Service Account:
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and create
   - Go to "Keys" tab > "Add Key" > "Create new key" > JSON
   - Save the JSON file (you'll need the client email)

3. Share the webhook topic with the service account:
   - Contact your infrastructure team to set up a Cloud Pub/Sub topic
   - Grant the service account `Pub/Sub Publisher` role

4. Enable Gmail push notifications:
   ```bash
   # After setting up Pub/Sub, run this once to enable notifications:
   curl -X POST https://www.googleapis.com/gmail/v1/users/me/watch \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "topicName": "projects/YOUR_PROJECT/topics/YOUR_TOPIC",
       "labelIds": ["INBOX"]
     }'
   ```

---

## 2. Outlook (Microsoft 365) Setup

### Step 2.1: Register an Application in Azure
1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "App registrations"
3. Click "New registration"
4. Fill in:
   - Name: Your app name (e.g., "Sales Funnel Email")
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"

### Step 2.2: Configure App
1. Go to **Certificates & secrets**
   - Click "New client secret"
   - Set expiration and copy the value (you won't see it again!)

2. Go to **API permissions**
   - Click "Add a permission"
   - Select "Microsoft Graph"
   - Choose "Delegated permissions" and add:
     - `Mail.Read`
     - `Mail.ReadBasic`
     - `Mail.ReadWrite`
     - `Mail.Send`
     - `User.Read`
     - `offline_access` (for refresh tokens)

3. Go to **Authentication**
   - Add redirect URI: `http://localhost:3000/api/oauth/microsoft/callback`
   - For production: `https://yourdomain.com/api/oauth/microsoft/callback`

### Step 2.3: Update .env File
```env
MICROSOFT_CLIENT_ID=your_application_id
MICROSOFT_CLIENT_SECRET=your_client_secret
```

### Step 2.4: (Optional) Enable Real-Time Webhooks
For real-time email syncing:

1. Set up webhook notifications in your app
2. Create a subscription to Microsoft Graph:
   ```bash
   curl -X POST https://graph.microsoft.com/v1.0/subscriptions \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "changeType": "created,updated",
       "notificationUrl": "https://yourdomain.com/api/webhooks/outlook",
       "resource": "/me/mailFolders('\''Inbox'\'')/messages",
       "expirationDateTime": "2025-12-31T23:59:59Z",
       "clientState": "YOUR_SECRET_STATE"
     }'
   ```

---

## 3. WebSocket Configuration (Real-Time Updates)

For real-time email notifications in the UI:

### Step 3.1: Update .env
```env
BASE_URL=http://localhost:3000
WS_PUBLISH_URL=https://ws.hpxeigen.com/publish
WS_PUBLISH_SECRET=your_websocket_secret
```

### Step 3.2: Test Real-Time Sync
After connecting an email account, you should see:
- ✅ Emails appear in the inbox
- ✅ New emails show up instantly when they arrive
- ✅ Read status updates in real-time

If emails don't sync in real-time:
- Check if webhooks are enabled (Gmail Pub/Sub, Outlook subscriptions)
- Manually trigger sync using the cron script below

---

## 4. Manual Email Sync (Cron Job)

If you haven't set up webhooks, you can sync emails on a schedule:

### Option A: Run Once
```bash
bun scripts/email-sync-cron.ts
```

### Option B: Schedule with Cron
```bash
# Every 5 minutes
*/5 * * * * cd /path/to/app && bun scripts/email-sync-cron.ts

# Every hour
0 * * * * cd /path/to/app && bun scripts/email-sync-cron.ts
```

### Option C: Schedule with PM2
```bash
pm2 start scripts/email-sync-cron.ts --cron "*/5 * * * *"
```

---

## 5. Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE_URL` | Yes | Your application URL (http://localhost:3000 for dev) |
| `GOOGLE_CLIENT_ID` | Yes (for Gmail) | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes (for Gmail) | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Yes (for Gmail) | OAuth callback URL |
| `MICROSOFT_CLIENT_ID` | Yes (for Outlook) | From Azure Portal |
| `MICROSOFT_CLIENT_SECRET` | Yes (for Outlook) | From Azure Portal |
| `EMAIL_ENCRYPTION_KEY` | Yes | 32-byte base64 key for token encryption |
| `WS_PUBLISH_URL` | Optional | WebSocket publish endpoint |
| `WS_PUBLISH_SECRET` | Optional | WebSocket authentication secret |

---

## 6. Testing the Setup

### Test Gmail Connection
```bash
curl http://localhost:3000/api/oauth/google
# Should redirect to Google consent screen
```

### Test Outlook Connection
```bash
curl http://localhost:3000/api/oauth/microsoft
# Should redirect to Microsoft login
```

### View Connected Accounts
```bash
curl http://localhost:3000/api/email/inbox
# Should show email threads if accounts are connected
```

### Check Sync Status
```bash
# Check database directly
sqlite3 dev.db "SELECT * FROM EmailAccount;"
```

---

## 7. Troubleshooting

### "Missing required environment variables"
```
Error: Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI
```
**Fix:** Update your `.env` file with valid credentials from Google Cloud Console

### "OAuth callback failed"
1. Check that redirect URIs match exactly in OAuth provider settings
2. Verify `BASE_URL` matches your actual domain
3. Check browser console for detailed error

### "Gmail token exchange failed"
1. Ensure Gmail API is enabled in Google Cloud Console
2. Check that Client Secret is correct (no extra spaces)
3. Verify redirect URI is registered

### "Failed to fetch Gmail profile"
1. Access token might be expired - this should refresh automatically
2. Check that Gmail API read permissions are granted
3. Try disconnecting and reconnecting the account

### Emails not syncing in real-time
1. **With webhooks enabled:** Check webhook delivery in Gmail Cloud Pub/Sub or Outlook subscription logs
2. **Without webhooks:** Run the cron job: `bun scripts/email-sync-cron.ts`
3. Check `EmailWebhookState` table for sync cursor positions

### WebSocket events not arriving
1. Verify `WS_PUBLISH_URL` and `WS_PUBLISH_SECRET` are correct
2. Check network inspector in browser for WebSocket connections
3. Check server logs for WebSocket publishing errors

---

## 8. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/google` | GET | Start Gmail OAuth flow |
| `/api/oauth/google/callback` | GET | Gmail OAuth callback (automatic) |
| `/api/oauth/microsoft` | GET | Start Outlook OAuth flow |
| `/api/oauth/microsoft/callback` | GET | Outlook OAuth callback (automatic) |
| `/api/email/inbox` | GET | Get email threads |
| `/api/email/thread/[id]` | GET | Get single thread details |
| `/api/email/recent` | GET | Get recent threads |
| `/api/email/unread-count` | GET | Get unread count |
| `/api/email/send` | POST | Send email |
| `/api/email/mark-read` | POST | Mark email as read |
| `/api/webhooks/gmail` | POST | Gmail push notifications |
| `/api/webhooks/outlook` | POST/GET | Outlook webhook notifications |

---

## 9. Next Steps

1. ✅ Update `.env` with OAuth credentials
2. ✅ Test Gmail connection at `/api/oauth/google`
3. ✅ Test Outlook connection at `/api/oauth/microsoft`
4. ✅ Set up cron job for automatic sync
5. ✅ (Optional) Enable real-time webhooks for instant updates
6. ✅ Check `/email` page to see synchronized emails

---

## Questions or Issues?

Check the logs:
```bash
# View application logs
tail -f ~/.pm2/logs/app-error.log

# View database emails
sqlite3 dev.db "SELECT id, subject, unreadCount FROM EmailThread LIMIT 10;"
```
