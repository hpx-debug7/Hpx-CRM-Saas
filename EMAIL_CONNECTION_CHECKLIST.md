# Email Connection Seamless Setup Checklist ✅

This checklist ensures your email integration is properly connected and working in real-time.

---

## 1. ENVIRONMENT VARIABLES

### Required Setup

```bash
# Copy .env and fill these values:
cp .env .env.local  # if using local override
```

### Variables to Configure

- [ ] `BASE_URL` = Your app URL (http://localhost:3000 for dev)
- [ ] `GOOGLE_CLIENT_ID` = From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` = From Google Cloud Console
- [ ] `GOOGLE_REDIRECT_URI` = http://localhost:3000/api/oauth/google/callback
- [ ] `MICROSOFT_CLIENT_ID` = From Azure Portal
- [ ] `MICROSOFT_CLIENT_SECRET` = From Azure Portal
- [ ] `EMAIL_ENCRYPTION_KEY` = 32-byte base64 key (already set ✓)
- [ ] `WS_PUBLISH_URL` = WebSocket publish endpoint
- [ ] `WS_PUBLISH_SECRET` = WebSocket authentication secret
- [ ] `NEXT_PUBLIC_WS_SUBSCRIBE_URL` = Frontend WebSocket URL (for real-time UI updates)

---

## 2. DATABASE SETUP

### Check if Database is Initialized

```bash
# Option 1: Check if dev.db exists
ls -la dev.db

# Option 2: Push schema to database (if not already done)
npm run db:push

# Option 3: Check tables in database
npx prisma studio
```

### Required Tables

- [ ] `User`
- [ ] `EmailAccount`
- [ ] `EmailThread`
- [ ] `EmailMessage`
- [ ] `EmailAttachment`
- [ ] `EmailThreadLead`
- [ ] `EmailWebhookState`
- [ ] `EmailSendAudit`
- [ ] `AuditLog`

**If tables are missing:**
```bash
npm run db:push
```

---

## 3. OAUTH CREDENTIALS

### Gmail Setup

```bash
# 1. Go to https://console.cloud.google.com/apis/credentials
# 2. Create new project (or use existing)
# 3. Enable Gmail API
# 4. Create OAuth 2.0 Web Application credentials
# 5. Add authorized redirect URI:
#    - http://localhost:3000/api/oauth/google/callback (dev)
#    - https://yourdomain.com/api/oauth/google/callback (prod)
# 6. Copy Client ID and Secret to .env
```

**Verification:**
```bash
curl -s http://localhost:3000/api/oauth/google
# Should redirect to Google consent screen
```

### Outlook Setup

```bash
# 1. Go to https://portal.azure.com
# 2. Search for "App registrations"
# 3. Create new registration
# 4. Get credentials from "Certificates & secrets"
# 5. Add API permissions: Mail.Read, Mail.Send, User.Read, offline_access
# 6. Add redirect URI: http://localhost:3000/api/oauth/microsoft/callback
# 7. Copy Client ID and Secret to .env
```

**Verification:**
```bash
curl -s http://localhost:3000/api/oauth/microsoft
# Should redirect to Microsoft login
```

---

## 4. REAL-TIME SYNC CONFIGURATION

### Option A: With Webhooks (Instant, Recommended)

#### Gmail Push Notifications

1. **Enable Gmail Pub/Sub:**
   ```bash
   # Create Pub/Sub topic in Google Cloud
   # Skip if using default: projects/YOUR_PROJECT/topics/gmail-sync
   ```

2. **Register webhook (after connecting Gmail account):**
   ```bash
   curl -X POST https://www.googleapis.com/gmail/v1/users/me/watch \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "topicName": "projects/YOUR_PROJECT/topics/gmail-sync",
       "labelIds": ["INBOX"]
     }'
   ```

#### Outlook Webhook Subscriptions

1. **Register webhook (after connecting Outlook account):**
   ```bash
   curl -X POST https://graph.microsoft.com/v1.0/subscriptions \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{
       "changeType": "created,updated",
       "notificationUrl": "https://yourdomain.com/api/webhooks/outlook",
       "resource": "/me/mailFolders(\"Inbox\")/messages",
       "expirationDateTime": "2025-12-31T23:59:59Z"
     }'
   ```

### Option B: Without Webhooks (Polling Every 5 Minutes)

```bash
# Run once to sync emails
bun scripts/email-sync-cron.ts

# Or add to crontab for recurring sync
# Edit crontab:
crontab -e

# Add this line:
*/5 * * * * cd /path/to/project && bun scripts/email-sync-cron.ts
```

### Option C: Test Mode (Manual, One-Time)

```bash
npm run dev
# Visit http://localhost:3000/email
# Click "Connect Gmail" or "Connect Outlook"
# Emails should appear within a few seconds
```

---

## 5. CONNECTION FLOW VERIFICATION

### Step 1: Start Application

```bash
npm run dev
```

### Step 2: Navigate to Email Page

```
http://localhost:3000/email
```

### Step 3: Connect Gmail (Test)

- [ ] Click "Connect Gmail" button
- [ ] You'll be redirected to Google consent screen
- [ ] Grant permissions
- [ ] You should be redirected back to `/email` page
- [ ] Emails should start appearing

**Troubleshooting if stuck:**
- Check browser console for errors
- Check server logs: `npm run dev` output
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Ensure redirect URI matches exactly

### Step 4: Connect Outlook (Test)

- [ ] Click "Connect Outlook" button
- [ ] You'll be redirected to Microsoft login
- [ ] Sign in with your account
- [ ] Grant permissions
- [ ] You should be redirected back to `/email` page
- [ ] Emails should start appearing

**Troubleshooting if stuck:**
- Check browser console for errors
- Verify `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`
- Ensure Outlook account has Mail permissions

### Step 5: Verify Emails Appear

- [ ] Threads show in left panel
- [ ] Can click threads to view messages
- [ ] Can see sender, subject, date
- [ ] Unread count appears in inbox header

---

## 6. REAL-TIME UPDATE VERIFICATION

### WebSocket Connection Check

1. **Open browser DevTools → Network → WS tab**
2. **Refresh the email page**
3. **Look for WebSocket connection to `wss://ws.hpxeigen.com/subscribe`**

**If WebSocket connects:**
- [ ] Connection status shows "Connected"
- [ ] New emails appear instantly (if webhooks enabled)
- [ ] Read status updates instantly

**If WebSocket fails to connect:**
- [ ] Check if `NEXT_PUBLIC_WS_SUBSCRIBE_URL` is set
- [ ] Verify WebSocket server is running
- [ ] Check network issues (firewall, proxy)
- [ ] Falls back to polling (emails appear within 5 minutes)

### Manual Real-Time Update Test

```bash
# Send test email to your connected account
# Should appear in inbox within 1-3 seconds (if webhooks enabled)
# Or within 5 minutes (if polling enabled)
```

---

## 7. API ENDPOINT VERIFICATION

Test each endpoint to ensure they're working:

```bash
# Get email threads
curl http://localhost:3000/api/email/inbox

# Get unread count
curl http://localhost:3000/api/email/unread-count

# Get recent emails
curl http://localhost:3000/api/email/recent?limit=5

# Get specific thread details
curl http://localhost:3000/api/email/thread/[thread-id]
```

**Expected response:**
```json
{
  "success": true,
  "data": [ /* email data */ ]
}
```

---

## 8. DATABASE VERIFICATION

Check if email data is being stored:

```bash
# Open Prisma Studio
npm run db:studio

# Or use SQLite directly:
sqlite3 dev.db "SELECT COUNT(*) as email_count FROM EmailThread;"
sqlite3 dev.db "SELECT COUNT(*) as account_count FROM EmailAccount;"
```

**Expected:**
- `EmailAccount` table has rows (one per connected account)
- `EmailThread` table has rows (one per email thread)
- `EmailMessage` table has rows (one per message)

---

## 9. COMMON ISSUES & SOLUTIONS

| Issue | Cause | Solution |
|-------|-------|----------|
| "Connect Gmail" button does nothing | OAuth not configured | Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| OAuth redirect infinite loop | Redirect URI mismatch | Ensure redirect URI matches exactly in OAuth provider |
| "Missing authorization code" | OAuth flow broke | Check browser network tab, verify credentials |
| Emails not syncing after connect | Email initial sync failed | Check server logs for sync errors |
| New emails not appearing | Webhooks not configured | Set up Gmail Pub/Sub or Outlook subscriptions |
| WebSocket not connecting | Frontend URL not set | Add `NEXT_PUBLIC_WS_SUBSCRIBE_URL` to `.env` |
| Email sending fails | Account not connected | Connect at least one email account first |

---

## 10. PRODUCTION DEPLOYMENT

When deploying to production:

1. **Update environment variables:**
   ```env
   BASE_URL=https://yourdomain.com
   GOOGLE_REDIRECT_URI=https://yourdomain.com/api/oauth/google/callback
   NEXT_PUBLIC_WS_SUBSCRIBE_URL=wss://yourdomain.com/subscribe
   ```

2. **Update OAuth redirect URIs:**
   - Google Cloud Console: Add production redirect URI
   - Azure Portal: Add production redirect URI

3. **SSL/TLS Required:**
   - WebSocket connections use `wss://` (secure)
   - OAuth requires HTTPS

4. **Set up cron job for email polling:**
   ```bash
   # On production server:
   # Every 5 minutes - sync all active email accounts
   */5 * * * * cd /var/www/app && bun scripts/email-sync-cron.ts
   ```

5. **Monitor webhook deliveries:**
   - Gmail: Check Cloud Pub/Sub delivery in Google Cloud Console
   - Outlook: Check subscription logs in Microsoft Graph API

---

## 11. QUICK START SCRIPT

```bash
#!/bin/bash
# automated-setup.sh

# 1. Install dependencies
npm install

# 2. Initialize database
npm run db:push

# 3. Start development server
npm run dev

# 4. Test API endpoints
echo "Testing API endpoints..."
curl http://localhost:3000/api/email/inbox
curl http://localhost:3000/api/email/unread-count

echo "✅ Setup complete! Visit http://localhost:3000/email to connect an account"
```

---

## 12. NEXT STEPS

1. ✅ Fill in `.env` with OAuth credentials
2. ✅ Run `npm run db:push` to initialize database
3. ✅ Run `npm run dev` to start application
4. ✅ Visit `http://localhost:3000/email`
5. ✅ Click "Connect Gmail" or "Connect Outlook"
6. ✅ Authorize and wait for emails to sync
7. ✅ (Optional) Set up webhooks for real-time sync
8. ✅ (Optional) Configure cron job for polling

---

## Need Help?

- **Email Setup Guide:** See `EMAIL_SETUP.md`
- **Troubleshooting:** See "Common Issues" section above
- **API Reference:** Check routes in `app/api/email/`
- **Database Schema:** Check `prisma/schema.prisma`

**Support Endpoints:**
- `/api/oauth/google` - Start Gmail OAuth
- `/api/oauth/microsoft` - Start Outlook OAuth
- `/api/email/inbox` - Get email threads
- `/api/webhooks/gmail` - Gmail webhook receiver
- `/api/webhooks/outlook` - Outlook webhook receiver
