# WFCA Active Fires Widget

Embeddable widget displaying current active wildfires with links to the [WFCA Fire Map](https://fire-map.wfca.com).

## Features

- Real-time wildfire data from WFCA Fire Map database
- Sortable columns: Name, Updated, Location, Acres
- Filter by state (CA, Texas, etc.) or fire name
- Pagination (10 fires per page)
- Light and dark themes
- Responsive design
- 5-minute caching to reduce server load
- No external dependencies

## Quick Start

### Embed on Your Website

```html
<!-- Add the widget container -->
<div id="wfca-fire-widget"
     data-limit="50"
     data-theme="light"
     data-title="Active Wildfires">
</div>

<!-- Load the widget script -->
<script src="https://wfca.com/widgets/fire-widget.js" async></script>
```

### Widget Options

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-limit` | 50 | Maximum fires to fetch (1-100) |
| `data-theme` | light | Theme: `light` or `dark` |
| `data-title` | Active Wildfires | Widget header title |
| `data-show-time` | true | Show update timestamp |
| `data-compact` | false | Compact mode for sidebars |

## API Endpoint

The widget fetches data from the WFCA Fire API:

```
GET /wp-json/wfca/v1/active-fires
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max results (1-100, default: 20) |
| `state` | string | Filter by state code (e.g., "CA", "TX") |
| `search` | string | Search fire names (substring match) |

### Example Response

```json
{
  "meta": {
    "generated_at": "2026-01-13T22:00:00+00:00",
    "count": 3,
    "cached": true,
    "cache_ttl": 300
  },
  "fires": [
    {
      "id": 1478930,
      "name": "South Fork",
      "irwin_id": "{CB33B743-0183-43F3-8E6E-C85B3C1C1D1C}",
      "updated": "2026-01-13 19:29:24",
      "acres": 6,
      "state": "US-MT",
      "county": "Fergus",
      "contained_pct": null,
      "map_url": "https://fire-map.wfca.com/?lng=-109.010395&lat=46.805200&zoom=15",
      "coords": {
        "lng": -109.010395,
        "lat": 46.8052,
        "zoom": 15
      }
    }
  ]
}
```

## Data Filtering

The widget shows fires updated within the **last 7 days** to match the WFCA Fire Map display.

### Filter Examples

- Type `CA` or `California` to show California fires
- Type `TX` or `Texas` to show Texas fires
- Type `South` to search fire names containing "South"

## Themes

### Light Theme (default)
```html
<div id="wfca-fire-widget" data-theme="light"></div>
```

### Dark Theme
```html
<div id="wfca-fire-widget" data-theme="dark"></div>
```

## Multiple Widgets

You can embed multiple widgets on the same page:

```html
<div data-wfca-widget="fire" data-theme="light" data-limit="10"></div>
<div data-wfca-widget="fire" data-theme="dark" data-limit="10"></div>
```

## Self-Hosting

To self-host the widget:

1. Clone this repository
2. Copy `.env.example` to `.env` and configure database credentials
3. Deploy `widgets/` folder to your web server
4. Update `CONFIG.apiUrl` in `fire-widget.js` to point to your API

### WordPress Integration

Add to your theme's `functions.php`:

```php
require_once get_template_directory() . '/widgets/class-wfca-fire-api.php';
```

The API will register at `/wp-json/wfca/v1/active-fires`.

## Security

- SQL injection protected via prepared statements
- XSS protected via output escaping
- CORS whitelist for allowed domains
- Sensitive files (.env, config.php) blocked via .htaccess

## License

Copyright (c) Western Fire Chiefs Association. All rights reserved.

## Support

For issues or questions, contact WFCA technical support.
