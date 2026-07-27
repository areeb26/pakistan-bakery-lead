# Pakistan Bakery Lead Scraper

A full-stack web application for scraping business leads from Google Maps and managing them through an intuitive dashboard.

![Status](https://img.shields.io/badge/status-ready_for_deployment-brightgreen)
![Frontend](https://img.shields.io/badge/frontend-React%2BTypeScript-blue)
![Backend](https://img.shields.io/badge/backend-FastAPI%2BPython-red)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 🔍 **Google Maps Scraping**: Search and scrape business data from Google Maps
- 📊 **Interactive Dashboard**: Browse, filter, and export scraped leads
- 🔄 **Real-time Updates**: Live lead data with filtering capabilities
- 📥 **Data Export**: Download leads as CSV or JSON
- 🌙 **Dark Mode Support**: Full dark mode theme
- 🚀 **Production Ready**: Configured for Vercel & Render deployment

## Tech Stack

### Frontend
- React 19.2.7
- TypeScript 6.0.2
- Vite 8.1.1
- Tailwind CSS 4.3.3
- React Router 7.18.1
- Axios 1.18.1

### Backend
- FastAPI 0.104.1
- Python 3.11+
- Playwright 1.40.0
- Uvicorn 0.24.0
- BeautifulSoup4 4.12.2

## Project Structure

```
.
├── api/                          # FastAPI Backend
│   ├── main.py                   # Main API server
│   ├── scrape_custom.py          # Scraping logic
│   └── requirements.txt          # Python dependencies
│
├── dashboard/                    # React Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ScrapePage.tsx    # Scraping interface
│   │   │   └── LeadsPage.tsx     # Leads display & filters
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vercel.json              # Vercel deployment config
│   ├── package.json
│   └── vite.config.ts
│
├── output/                       # Scraped data storage
├── render.yaml                   # Render deployment config
├── DEPLOYMENT.md                 # Full deployment guide
└── TESTING_SUMMARY.md           # Test results

```

## Quick Start

### Local Development

**Prerequisites:**
- Node.js 18+
- Python 3.11+
- npm or yarn

**Backend Setup:**
```bash
cd /path/to/project
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r api/requirements.txt
python -m uvicorn api.main:app --reload --port 8000
```

**Frontend Setup:**
```bash
cd dashboard
npm install
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Environment Variables

**Local Development** (`.env`):
```
VITE_API_URL=http://localhost:8000
```

**Production** (Vercel):
```
VITE_API_URL=https://your-render-backend.onrender.com
```

## Deployment

### Frontend (Vercel)
1. Push to GitHub
2. Connect repo to Vercel
3. Set environment variable: `VITE_API_URL`
4. Deploy automatically on push

### Backend (Render)
1. Push to GitHub
2. Connect repo to Render
3. Render auto-detects `render.yaml`
4. Deploy with Python 3.11 runtime

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## API Endpoints

### Scraping
- `POST /scrape` - Start a new scraping job
  - Query parameters: `query`, `limit`, `headless`
  - Response: `{"success": true, "count": number}`

### Leads
- `GET /leads` - Get all scraped leads
  - Response: `{"leads": [...], "count": number}`
- `DELETE /leads` - Clear all leads

### Health
- `GET /health` - Health check
  - Response: `{"status": "ok"}`

## Features

### Scraping
- Search any location/business type
- Configurable result limit (1-500)
- Headless browser mode
- Real-time progress tracking

### Lead Management
- View all scraped leads
- Filter by business name or address
- Filter by phone availability
- Filter by website availability
- Sort and search capabilities

### Data Export
- Export as JSON
- Export as CSV
- Timestamped filenames
- Full lead details included

## Performance

- Frontend build: ~300ms
- Bundle size: 79 KB (gzipped)
- API response time: <200ms (local)
- Scraping: ~30-60 seconds for 50 leads

## Testing

All components have been tested:
- ✅ Frontend build & dev server
- ✅ Backend API endpoints
- ✅ Database connectivity
- ✅ End-to-end integration

See [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) for detailed results.

## Environment Setup

### Development
```bash
# Clone the repository
git clone https://github.com/areeb26/pakistan-bakery-lead.git
cd pakistan-bakery-lead

# Backend
python -m venv venv
source venv/bin/activate
pip install -r api/requirements.txt

# Frontend
cd dashboard
npm install
```

### Production
See [DEPLOYMENT_QUICK_START.txt](./DEPLOYMENT_QUICK_START.txt) for 3-step deployment.

## Troubleshooting

### API Connection Error
- Ensure backend is running on port 8000
- Check `VITE_API_URL` environment variable
- Verify CORS headers in responses

### Playwright Installation Issues
- Run: `playwright install`
- May need system dependencies: `sudo apt-get install -y libgbm1`

### Scraping Timeout
- Reduce the `limit` parameter
- Check network connectivity
- Verify Google Maps is accessible

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guides
2. Review [TESTING_SUMMARY.md](./TESTING_SUMMARY.md) for test results
3. Check GitHub Issues

## Deployment Status

- ✅ Frontend ready for Vercel
- ✅ Backend ready for Render
- ✅ Environment configuration complete
- ✅ All tests passing
- ✅ Documentation complete

## Quick Links

- 🌐 [Repository](https://github.com/areeb26/pakistan-bakery-lead)
- 📖 [Full Deployment Guide](./DEPLOYMENT.md)
- ⚡ [Quick Start](./DEPLOYMENT_QUICK_START.txt)
- 🧪 [Test Results](./TESTING_SUMMARY.md)

---

**Ready to deploy?** Follow the [DEPLOYMENT_QUICK_START.txt](./DEPLOYMENT_QUICK_START.txt) for 3 easy steps!
