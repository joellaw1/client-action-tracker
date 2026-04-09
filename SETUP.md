# ActionTracker — Setup Guide

## What This Is

A smart action item tracker for your law firm that:

1. **Tracks client action items** in a Google Sheet your whole team can see
2. **Scans email with Gemini AI** to detect client requests ("Can you prepare...") and your commitments ("I'll get you that by Friday")
3. **Proactively suggests follow-up work** — e.g., when a client closes a financing round, the system suggests updating the cap table, filing Form D, etc.
4. **Provides a dashboard** for the attorneys to review, approve, and manage everything

## Architecture

```
Gmail (read-only) → Gemini 2.5 Pro → Google Sheets ← Dashboard App
                                         ↑
                              Partner/Secretary view
                              (just opens the Sheet)
```

- **Data lives in Google Sheets** — everyone can see it without learning new software
- **Dashboard app** is the smart layer — shows the data with filtering, AI suggestions, and the trigger engine
- **Gemini scans email** every 30 minutes and writes draft items to the "Email Scans" tab
- **You review and approve** — nothing becomes a real action item without human confirmation

## Quick Start (MVP)

### Step 1: Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project called "ActionTracker"
3. Enable these APIs:
   - Gmail API
   - Google Sheets API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Set up OAuth consent screen:
   - User type: Internal (if using Google Workspace) or External
   - Add your two email addresses as test users
   - Scopes: `gmail.readonly`, `spreadsheets`

### Step 2: Create the Google Sheet

1. Create a new Google Sheet
2. Note the spreadsheet ID from the URL
3. The app will auto-create all tabs and headers on first run

### Step 3: Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. This key uses Gemini 2.5 Pro for email analysis

### Step 4: Configure & Run

```bash
# Clone and install
cd client-action-tracker
npm install

# Copy environment config
cp env.example .env.local
# Edit .env.local with your values

# Run the initial OAuth flow to get your refresh token
npm run auth-setup

# Initialize the Google Sheet with tabs and headers
npm run init-sheet

# Start the app
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## File Structure

```
client-action-tracker/
├── app-prototype.jsx          # Interactive UI prototype (React)
├── lib/
│   ├── gemini-scanner.ts      # Gemini AI email extraction
│   ├── gmail-integration.ts   # Gmail API connection
│   ├── sheets-data-layer.ts   # Google Sheets as database
│   └── trigger-engine.ts      # Proactive trigger rules
├── schema.sql                 # Database schema (if migrating to Postgres later)
├── env.example                # Environment variable template
└── SETUP.md                   # This file
```

## Security Notes for Law Firms

- **Gmail access is read-only** — the app cannot send, modify, or delete emails
- **Gemini API mode** — your email content is processed but not stored or used for training
- **Google Sheets** — protected by your existing Google Workspace security (2FA, admin controls)
- **All AI suggestions require human approval** — nothing is auto-created
- **Audit log** tracks all actions in a dedicated Sheet tab
- **No client data leaves Google's ecosystem** when using Gemini + Sheets

## Deploy to Railway

This app deploys to Railway as its own isolated project — completely separate from any
TalksOnLaw infrastructure. Railway handles HTTPS, auto-restarts, and environment variables.

### First-Time Deploy

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login (creates a Railway account if you don't have one)
railway login

# 3. Create a new project (this is standalone, not linked to TalksOnLaw)
railway init

# 4. Add your environment variables
railway variables set GOOGLE_SHEETS_ID=your_id
railway variables set GOOGLE_CLIENT_ID=your_client_id
railway variables set GOOGLE_CLIENT_SECRET=your_secret
railway variables set GOOGLE_REDIRECT_URI=https://your-app.up.railway.app/api/auth/callback/google
railway variables set GOOGLE_REFRESH_TOKEN=your_refresh_token
railway variables set GEMINI_API_KEY=your_key
railway variables set FIRM_ATTORNEY_EMAILS=joel@paradoxprincipals.com,partner@paradoxprincipals.com
railway variables set SCAN_INTERVAL_MINUTES=30
railway variables set MIN_CONFIDENCE_THRESHOLD=0.75
railway variables set ENABLE_PROACTIVE_TRIGGERS=true
railway variables set NEXTAUTH_SECRET=$(openssl rand -base64 32)
railway variables set NEXTAUTH_URL=https://your-app.up.railway.app

# 5. Deploy
railway up

# 6. Get your public URL
railway domain
```

### Updating After Changes

```bash
# Just push again — Railway rebuilds automatically
railway up
```

### Custom Domain (Optional)

In the Railway dashboard → your project → Settings → Domains, you can add a custom
domain (e.g., `tracker.yourfirm.com`). Railway provides the DNS records to configure.

### Cost

Expect ~$5-10/month for this app on Railway's Pro plan. Usage-based billing, no surprises.

## IMPORTANT: Entity Separation

This project is intentionally separate from TalksOnLaw:

- **Separate Railway project** — its own billing, its own deploy pipeline
- **Separate Google Cloud project** — its own OAuth credentials, its own API keys
- **Separate Google Sheet** — no shared data with TalksOnLaw resources
- If you use a custom domain, register it under the correct entity

## Next Steps After MVP

- [ ] Add Clio "Push to Clio" button for on-demand matter creation
- [ ] Build more trigger rules as you identify patterns in your practice
- [ ] Add email/Slack notification when high-priority items are detected
- [ ] Consider Postgres migration if Sheets gets slow (unlikely below 10,000 rows)
- [ ] Add partner login (NextAuth with Google) so each attorney sees their own items
