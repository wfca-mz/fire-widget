# WFCA Widgets - Project Instructions

## Overview
Embeddable widgets for WFCA (Western Fire Chiefs Association) websites. Currently includes the Active Fires Widget which displays recent wildfire incidents with links to the WFCA Fire Map.

## Project Structure
```
wfca.local/
├── private_html/               # NOT web-accessible
│   ├── .env                    # Environment config & DB credentials (DO NOT COMMIT)
│   └── .env.example            # Template for credentials
├── public_html/                # Web-accessible root
│   ├── .htaccess               # Security rules
│   └── widgets/
│       ├── .htaccess           # Widget-specific security
│       ├── cache/              # File-based API cache (auto-created, auto-cleaned)
│       ├── class-wfca-fire-api.php  # PHP API endpoint
│       ├── config.php          # Config loader (reads from private_html/.env)
│       ├── fire-widget.js      # Embeddable widget JS
│       ├── test.php            # Local testing page (PHP for env injection)
│       ├── favicon.ico         # Fire emoji favicon
│       ├── CLAUDE.md           # This file
│       ├── README.md           # Public documentation
│       └── 01_view_widget_data.sql  # Database view (reference)
├── .git/                       # Version control
└── .gitignore
```

## Local Development

### Start the test server
```bash
cd public_html/widgets
php -S localhost:8080
open http://localhost:8080/test.php
```

### Test API directly
```bash
# All fires (last 7 days)
curl "http://localhost:8080/class-wfca-fire-api.php?limit=50"

# Filter by state
curl "http://localhost:8080/class-wfca-fire-api.php?state=CA"

# Search by fire name
curl "http://localhost:8080/class-wfca-fire-api.php?search=south"
```

## Database
- **Host**: PostgreSQL on AWS RDS (credentials in .env)
- **Schema**: `data` schema with fire perimeter and incident views
- **7-day filter**: Only shows fires updated within last 7 days
- **Caching**: 5-minute file cache to reduce DB load

## Key Files

### class-wfca-fire-api.php
- REST API endpoint for fire data
- Works standalone or as WordPress REST endpoint
- Handles: state filter, name search, pagination
- Security: prepared statements, input sanitization, CORS whitelist

### fire-widget.js
- Self-contained embeddable widget
- Injects own CSS, no dependencies
- Features: sorting, filtering, pagination, light/dark themes
- XSS-safe: all output escaped

## Deployment Options

### Current: Standalone PHP (for initial deployment)
- Place files in web-accessible directory on wfca.com
- Configure credentials via .env or environment variables
- Works immediately with existing WordPress site

### Future Recommendation: Migrate API to fire-map.wfca.com

**Why migrate to Next.js on fire-map.wfca.com:**
1. **Single credential source** - fire-map already has PostgreSQL connection, no duplicate credentials
2. **Same data source** - widget and map use same DB, should stay coupled
3. **Simpler stack** - TypeScript API route vs maintaining separate PHP
4. **Cleaner security** - credentials only exist in one place

**Recommended architecture after migration:**
- **API**: `https://fire-map.wfca.com/api/active-fires` (Next.js API route)
- **Widget JS**: `https://wfca.com/widgets/fire-widget.js` (or CDN)
- Update `CONFIG.apiUrl` in fire-widget.js to point to fire-map API
- Configure CORS on fire-map to allow wfca.com origin

**Migration steps (when ready):**
1. Deploy current PHP version to wfca.com (working now)
2. Create Next.js API route on fire-map.wfca.com mirroring PHP logic
3. Test new endpoint
4. Update fire-widget.js CONFIG.apiUrl
5. Remove PHP API from wfca.com

### WordPress REST API (alternative)
- Add to theme functions.php or create plugin
- Endpoint: `/wp-json/wfca/v1/active-fires`
- Uses WordPress transients for caching instead of file-based

## Security Checklist
- [ ] .env file protected by .htaccess
- [ ] config.php not web-accessible
- [ ] Cache directory protected
- [ ] CORS whitelist configured for production domains
- [ ] SQL injection: uses prepared statements
- [ ] XSS: all output escaped

## Environment Variables

Configure in `private_html/.env`:

```bash
# Environment: development | production
ENVIRONMENT=development

# API URLs by environment
DEV_API_URL=http://localhost:8080/class-wfca-fire-api.php
PROD_API_URL=https://wfca.com/widgets/class-wfca-fire-api.php

# Fire Map URL
FIRE_MAP_URL=https://fire-map.wfca.com

# PostgreSQL Database
WFCA_PG_HOST=     # PostgreSQL host
WFCA_PG_NAME=     # Database name
WFCA_PG_USER=     # Database user
WFCA_PG_PASS=     # Database password
WFCA_PG_PORT=5432 # PostgreSQL port
```

### Switching Environments

To switch from development to production, edit `.env`:
```bash
ENVIRONMENT=production
```

The test page will show current environment and API URL at the top.

## Cache Management

- **TTL**: 5 minutes per query
- **Auto-cleanup**: Runs on 1% of requests, removes files older than 1 hour
- **Location**: `public_html/widgets/cache/`
- **Protected**: `.htaccess` blocks web access to cache files
