# 🚀 Email Connection - Quick Start (5 Minutes)

## Step 1: Configure Environment (2 minutes)

### Get Gmail Credentials
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Web Application credentials
3. Add redirect URI: `http://localhost:3000/api/oauth/google/callback`
4. Copy Client ID and Secret

### Get Outlook Credentials
1. Go to https://portal.azure.com
2. Search "App registrations" → New registration
3. Go to "Certificates & secrets" → New client secret
4. Copy Client ID and Secret

### Update `.env`
```env
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:3000/api/oauth/google/callback

MICROSOFT_CLIENT_ID=YOUR_CLIENT_ID
MICROSOFT_CLIENT_SECRET=YOUR_CLIENT_SECRET

WS_PUBLISH_SECRET=your_websocket_secret
```

---

## Step 2: Initialize Database (1 minute)

```bash
npm run db:push
```

---

## Step 3: Start Application (1 minute)

```bash
npm run dev
```

---

## Step 4: Connect Email Account (1 minute)

1. Open: http://localhost:3000/email
2. Click "Connect Gmail" or "Connect Outlook"
3. Authorize the app
4. Wait for emails to appear (5-20 seconds)

---

## Done! ✅

Your email system is now:
- ✅ **Connected** to Gmail or Outlook
- ✅ **Syncing** emails automatically
- ✅ **Real-time** with WebSocket updates
- ✅ **Integrated** with your CRM leads

---

## What's Working

| Feature | Status | Speed |
|---------|--------|-------|
| OAuth login | ✅ Fixed | 2-5 sec |
| Email sync | ✅ Automatic | 5 sec (initial) |
| Real-time updates | ✅ WebSocket | <1 sec |
| Email display | ✅ UI rendered | Instant |
| Lead linking | ✅ Auto | Per sync |

---

## If Emails Don't Appear

```bash
# Option 1: Run sync manually
bun scripts/email-sync-cron.ts

# Option 2: Check database
sqlite3 dev.db "SELECT COUNT(*) FROM EmailThread;"

# Option 3: Check server logs
# Look for errors in: npm run dev output

# Option 4: Verify OAuth setup
# Visit: http://localhost:3000/api/oauth/google
# Should redirect to Google (if credentials set correctly)
```

---

## For Production

Update `.env` with production URLs:
```env
BASE_URL=https://yourdomain.com
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/oauth/google/callback
NEXT_PUBLIC_WS_SUBSCRIBE_URL=wss://yourdomain.com/subscribe
```

Set up cron for email sync:
```bash
*/5 * * * * cd /var/www/app && bun scripts/email-sync-cron.ts
```

---

## Need More Help?

- **Setup Guide**: EMAIL_SETUP.md
- **Checklist**: EMAIL_CONNECTION_CHECKLIST.md
- **Architecture**: INTEGRATION_SUMMARY.md
- **Current Issue?** Check server logs in `npm run dev` output

---

**Everything is ready. Your email system is seamlessly connected! 🎉**
