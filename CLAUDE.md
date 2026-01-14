# WFCA Widgets - Project Instructions

## Overview
Embeddable widgets for WFCA (Western Fire Chiefs Association) websites. Currently includes the Active Fires Widget which displays recent wildfire incidents with links to the WFCA Fire Map.

## Project Structure
```
wfca.local/
├── .env                    # Database credentials (DO NOT COMMIT)
├── .env.example            # Template for credentials
├── .htaccess               # Security rules
├── CLAUDE.md               # This file
├── README.md               # Public documentation
└── widgets/
    ├── .htaccess           # Widget-specific security
    ├── cache/              # File-based API cache (auto-created)
    ├── class-wfca-fire-api.php  # PHP API endpoint
    ├── config.php          # Local config loader
    ├── fire-widget.js      # Embeddable widget JS
    ├── test.html           # Local testing page
    └── 01_view_widget_data.sql  # Database view (reference)
```

## Local Development

### Start the test server
```bash
cd widgets
php -S localhost:8080
open http://localhost:8080/test.html
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

1. **WordPress REST API** (recommended for wfca.com)
   - Add to theme functions.php or create plugin
   - Endpoint: `/wp-json/wfca/v1/active-fires`

2. **Standalone PHP**
   - Place files in web-accessible directory
   - Configure credentials via .env or environment variables

## Security Checklist
- [ ] .env file protected by .htaccess
- [ ] config.php not web-accessible
- [ ] Cache directory protected
- [ ] CORS whitelist configured for production domains
- [ ] SQL injection: uses prepared statements
- [ ] XSS: all output escaped

## Environment Variables
```
WFCA_PG_HOST=     # PostgreSQL host
WFCA_PG_NAME=     # Database name
WFCA_PG_USER=     # Database user
WFCA_PG_PASS=     # Database password
WFCA_PG_PORT=5432 # PostgreSQL port
```
