# Pakistan Bakery Lead Scraper - Deployment Guide

## Overview

This is a full-stack application with:
- **Frontend**: React + TypeScript + Vite (deploys to Vercel)
- **Backend**: FastAPI + Python (deploys to Render)

## Prerequisites

Before deploying, you'll need:
1. GitHub account (to push your code)
2. Vercel account (vercel.com)
3. Render account (render.com)

## Step 1: Prepare Your Repository

### Initialize Git (if not already done)
```bash
cd /path/to/project
git init
git add .
git commit -m "Initial commit: Pakistan Bakery Lead Scraper"
```

### Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

### Setup Steps:

1. **Go to [render.com](https://render.com)** and sign in
2. **Click "New +" → "Web Service"**
3. **Connect your GitHub repository**
4. **Fill in the deployment details:**
   - **Name**: `pakistan-bakery-api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r api/requirements.txt && playwright install`
   - **Start Command**: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - **Branch**: `main`

5. **Add Environment Variables:**
   - `PYTHONUNBUFFERED`: `true`

6. **Click "Deploy"** and wait for the build to complete

### Get Your Backend URL
After deployment, Render will give you a URL like: `https://pakistan-bakery-api.onrender.com`

Save this URL - you'll need it for the frontend deployment.

---

## Step 3: Deploy Frontend to Vercel

### Setup Steps:

1. **Go to [vercel.com](https://vercel.com)** and sign in
2. **Click "Add New..." → "Project"**
3. **Import your GitHub repository**
4. **Configure the project:**
   - **Framework Preset**: `Vite`
   - **Root Directory**: `dashboard`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Add Environment Variables:**
   - **Name**: `VITE_API_URL`
   - **Value**: `https://pakistan-bakery-api.onrender.com` (or your Render URL)

6. **Click "Deploy"** and wait for the build to complete

### Your Frontend URL
After deployment, Vercel will give you a URL like: `https://pakistan-bakery-lead.vercel.app`

---

## Step 4: Testing the Deployment

1. **Visit your Vercel URL** in a browser
2. **Try the Scrape page**: Enter a search query and click "Start Scraping"
3. **Check the Leads page**: View the scraped results

If you see an error connecting to the API:
- Double-check that `VITE_API_URL` is set correctly in Vercel environment variables
- Verify your Render backend is running (check Render dashboard)
- Make sure CORS is properly configured (it should be in `api/main.py`)

---

## Local Development

### Running Locally

**Terminal 1 - Start Backend:**
```bash
cd /path/to/project
python -m uvicorn api.main:app --reload --port 8000
```

**Terminal 2 - Start Frontend:**
```bash
cd dashboard
npm install  # if you haven't already
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Environment Setup

1. **For local dev**, the `.env` file already uses `http://localhost:8000`
2. **For production**, Vercel environment variables override the `.env` file

---

## Project Structure

```
.
├── api/
│   ├── main.py          # FastAPI application
│   ├── scrape_custom.py # Scraper logic
│   └── requirements.txt  # Python dependencies
├── dashboard/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ScrapePage.tsx
│   │   │   └── LeadsPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── vercel.json      # Vercel deployment config
│   └── .env             # Local environment variables
├── render.yaml          # Render deployment config
└── output/              # Data storage
```

---

## Troubleshooting

### Frontend builds but shows "API connection error"

**Solution**: 
1. Check that your Render backend URL is correct
2. Verify `VITE_API_URL` environment variable is set in Vercel
3. Check that the Render service is in "Live" status

### Backend deployment fails

**Solution**:
1. Ensure `render.yaml` is in the project root
2. Check that `api/requirements.txt` has all dependencies
3. Look at the Render build logs for specific errors

### Scraper times out

**Solution**:
- Render free tier has limited resources. Consider upgrading if scraping large datasets
- Reduce the `limit` parameter to 20-50 leads per scrape

### CORS errors in browser console

**Solution**:
- This should be handled automatically by the FastAPI CORS middleware
- If issues persist, update `allow_origins` in `api/main.py`

---

## Monitoring

### Render Dashboard
- View logs at: https://dashboard.render.com
- Check service status and restart if needed

### Vercel Dashboard
- View build logs and analytics at: https://vercel.com/dashboard
- Monitor performance and errors

---

## Next Steps

1. Monitor both services after deployment
2. Collect usage metrics and optimize as needed
3. Consider database integration for persistent data storage
4. Add authentication if needed for production

---

## Support

For issues:
- Check Render logs: https://dashboard.render.com
- Check Vercel logs: https://vercel.com/dashboard
- Verify environment variables match expected values

Happy deploying! 🚀
