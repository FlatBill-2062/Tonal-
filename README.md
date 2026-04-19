# Tonal — Deployment Guide

## What's in this folder

```
tonal/
  api/
    analyze.js   ← the server function (calls Anthropic on your behalf)
  index.html     ← the app frontend
  vercel.json    ← Vercel configuration
```

## How to deploy (step by step)

### 1. Create a GitHub account
Go to github.com and sign up (free).

### 2. Create a new repository
- Click the + button → New repository
- Name it "tonal"
- Keep it Public
- Click Create repository

### 3. Upload your files
- Click "uploading an existing file"
- Drag ALL files from this folder into the page (including the api folder)
- Click Commit changes

### 4. Deploy on Vercel
- Go to vercel.com and sign up with your GitHub account
- Click "Add New Project"
- Select your "tonal" repository
- Click Deploy

### 5. Add your API key
- In Vercel, go to your project → Settings → Environment Variables
- Add a new variable:
  - Name:  ANTHROPIC_API_KEY
  - Value: your key starting with sk-ant-...
- Click Save
- Go to Deployments → click the three dots on your latest deployment → Redeploy

### 6. Done
Vercel gives you a live URL like tonal-abc123.vercel.app
That's your app — share it with anyone.

## Why this is different from the old version
The old version tried to call Anthropic directly from the browser, which browsers
block for security reasons. This version has a small server function (api/analyze.js)
that makes the call on your behalf. Your API key is stored safely in Vercel and
never exposed to anyone using the app.
