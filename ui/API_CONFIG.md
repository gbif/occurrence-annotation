# API Configuration Guide

The UI can be configured to work with either a local development backend or the production GBIF API.

## Configuration Options

### Environment Variables

Create environment files in the `ui/` directory:

- `.env.local` - For local development
- `.env.production` - For production builds

### Available Variables

- `VITE_API_MODE` - Set to `local` or `production`
- `VITE_LOCAL_API_BASE_URL` - Local backend URL (default: `http://localhost:8080`)
- `VITE_GBIF_API_BASE_URL` - GBIF API URL (default: `https://api.gbif.org/v1`)

## Local Development Setup

1. **Start the backend service:**
   ```bash
   cd backend-service
   docker-compose up
   ```

2. **Configure the UI for local development:**
   Create `ui/.env.local`:
   ```env
   VITE_API_MODE=local
   VITE_LOCAL_API_BASE_URL=http://localhost:8080
   VITE_GBIF_API_BASE_URL=https://api.gbif.org/v1
   ```

3. **Start the UI development server:**
   ```bash
   cd ui
   npm run dev
   ```

## Production Setup

1. **Configure for production:**
   Create `ui/.env.production`:
   ```env
   VITE_API_MODE=production
   VITE_GBIF_API_BASE_URL=https://api.gbif.org/v1
   ```

2. **Build and deploy:**
   ```bash
   cd ui
   npm run build
   ```

## API Endpoints

### Local Mode (`VITE_API_MODE=local`)
- **Annotation Rules API:** `http://localhost:8080/occurrence/experimental/annotation/*`
- **Species Lookup:** `https://api.gbif.org/v1/species/*` (always uses GBIF)

### Production Mode (`VITE_API_MODE=production`)
- **All APIs:** `https://api.gbif.org/v1/*`

## Features Available in Local Mode

When `VITE_API_MODE=local`, you can:

✅ **Test Year Range Functionality**
- Filter rules by year ranges like `1800,1900`, `2000,*`, `*,1950`
- Create rules with year range constraints

✅ **Test Basis of Record Filtering**
- Filter by `PRESERVED_SPECIMEN`, `HUMAN_OBSERVATION`, etc.

✅ **Test CRUD Operations**
- Create, read, update, delete annotation rules
- Add and manage comments
- Support/contest rules

✅ **Development & Testing**
- No rate limits
- Full control over data
- Debug API responses

## Switching Between Modes

Simply change the `VITE_API_MODE` environment variable and restart the development server:

```bash
# Switch to local mode
echo "VITE_API_MODE=local" > .env.local

# Switch to production mode  
echo "VITE_API_MODE=production" > .env.local

# Restart the dev server
npm run dev
```

## Debug Information

In development mode, the console will show the current API configuration:

```
🔧 API Configuration: {
  mode: "local",
  annotationApiBaseUrl: "http://localhost:8080",
  gbifApiBaseUrl: "https://api.gbif.org/v1"
}
```

## Troubleshooting

### CORS Issues
- The Vite dev server includes a proxy configuration for `/api` routes
- Ensure the backend is running on `http://localhost:8080`

### Authentication
- Use the same GBIF credentials for both local and production modes
- Local backend uses the same authentication as production GBIF API

### Year Range Testing
- Make sure the backend database has the `year_range` column
- Check that sample data includes various year range formats