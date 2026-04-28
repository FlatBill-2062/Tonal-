# Tonal — Update Instructions

You already have a GitHub repo and Vercel project set up.
All you need to do is replace the files.

## Files in this folder
- index.html       → the full app frontend
- api/analyze.js   → the server function (handles the API call)
- vercel.json      → Vercel configuration
- README.md        → this file

## How to update your existing GitHub repo

1. Go to your GitHub repo (github.com)
2. Click on the existing `index.html` file
3. Click the pencil icon (Edit) → then click the three dots → Delete file
4. Repeat for `api/analyze.js` and `vercel.json`
5. Once old files are deleted, click "Add file" → "Upload files"
6. Drag ALL files from this folder in (including the api folder)
7. Click "Commit changes"

Vercel will automatically redeploy within about 30 seconds.

## Environment variable (check this is still set)

In Vercel → your project → Settings → Environment Variables:
- Name:  ANTHROPIC_API_KEY
- Value: your key starting with sk-ant-...
- All three boxes ticked: Production, Preview, Development

## That's it
Once redeployed, open your Vercel URL and the full Tonal app will be live.
