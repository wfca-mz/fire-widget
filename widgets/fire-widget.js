/**
 * WFCA Active Fires Widget
 * 
 * Embeddable widget showing current active wildfires with links to Fire Map.
 * 
 * USAGE:
 * 
 *   <!-- Basic embed -->
 *   <div id="wfca-fire-widget"></div>
 *   <script src="https://wfca.com/widgets/fire-widget.js" async></script>
 * 
 *   <!-- With options -->
 *   <div id="wfca-fire-widget"
 *        data-limit="10"
 *        data-theme="light"
 *        data-title="Active Wildfires">
 *   </div>
 *
 *   <!-- Prefiltered by state -->
 *   <div id="wfca-fire-widget" data-query="CA"></div>
 *
 * OPTIONS (via data attributes):
 *   data-limit      Number of fires to show (default: 10, max: 50)
 *   data-theme      "light" or "dark" (default: light)
 *   data-title      Custom widget title
 *   data-show-time  Show "updated at" timestamp (default: true)
 *   data-compact    Compact mode for sidebars (default: false)
 *   data-query      Preload with filter (state code, state name, or fire name)
 * 
 * @version 1.0.0
 * @author WFCA
 */
(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION - Edit these for your deployment
    // ========================================================================

    const WFCA_API_ENDPOINT = 'https://wfca.com/widgets/class-wfca-fire-api.php';
    const WFCA_FIRE_MAP_URL = 'https://fire-map.wfca.com';

    // ========================================================================
    // RUNTIME CONFIG - Do not edit below
    // ========================================================================

    const CONFIG = {
        // API endpoint - override with window.WFCA_API_URL for local dev
        apiUrl: window.WFCA_API_URL || WFCA_API_ENDPOINT,

        // Auto-refresh interval (5 minutes)
        refreshInterval: 5 * 60 * 1000,

        // Default widget container ID
        containerId: 'wfca-fire-widget',

        // Fire Map base URL
        fireMapUrl: WFCA_FIRE_MAP_URL,
    };

    // ========================================================================
    // STYLES
    // ========================================================================
    
    const STYLES = `
        /* Base widget container */
        .wfca-fw {
            --wfca-primary: #d32f2f;
            --wfca-primary-dark: #b71c1c;
            --wfca-text: #333;
            --wfca-text-light: #666;
            --wfca-border: #e0e0e0;
            --wfca-bg: #fff;
            --wfca-bg-hover: #f5f5f5;
            --wfca-link: #1976d2;

            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                         'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            color: var(--wfca-text);
            background: var(--wfca-bg);
            border: 1px solid var(--wfca-border);
            border-radius: 8px;
            overflow: hidden;
            max-width: 100%;
        }

        /* Dark theme */
        .wfca-fw--dark {
            --wfca-text: #e0e0e0;
            --wfca-text-light: #999;
            --wfca-border: #444;
            --wfca-bg: #1e1e1e;
            --wfca-bg-hover: #2a2a2a;
            --wfca-link: #64b5f6;
        }

        /* Compact mode */
        .wfca-fw--compact .wfca-fw__item {
            padding: 6px 12px;
        }
        .wfca-fw--compact .wfca-fw__header {
            padding: 8px 12px;
        }
        .wfca-fw--compact .wfca-fw__controls {
            display: none;
        }

        /* Header */
        .wfca-fw__header {
            background: linear-gradient(135deg, var(--wfca-primary) 0%, #f57c00 100%);
            color: #fff;
            padding: 8px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .wfca-fw__title {
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .wfca-fw__title a {
            color: inherit;
            text-decoration: none;
        }

        .wfca-fw__title a:hover {
            text-decoration: underline;
        }

        .wfca-fw__count {
            background: rgba(255, 255, 255, 0.2);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 500;
        }

        /* Controls (filter/sort) */
        .wfca-fw__controls {
            display: flex;
            gap: 6px;
            padding: 6px 10px;
            background: var(--wfca-bg-hover);
            border-bottom: 1px solid var(--wfca-border);
            flex-wrap: wrap;
        }

        .wfca-fw__filter {
            flex: 1;
            min-width: 100px;
            padding: 4px 8px;
            border: 1px solid var(--wfca-border);
            border-radius: 4px;
            font-size: 12px;
            background: var(--wfca-bg);
            color: var(--wfca-text);
        }

        .wfca-fw__filter:focus {
            outline: none;
            border-color: var(--wfca-primary);
        }

        .wfca-fw__sort {
            padding: 4px 8px;
            border: 1px solid var(--wfca-border);
            border-radius: 4px;
            font-size: 12px;
            background: var(--wfca-bg);
            color: var(--wfca-text);
            cursor: pointer;
        }

        .wfca-fw__sort:focus {
            outline: none;
            border-color: var(--wfca-primary);
        }

        /* Table-style list */
        .wfca-fw__table-header {
            display: grid;
            grid-template-columns: 1.5fr 70px 1fr 60px;
            gap: 4px;
            padding: 6px 10px;
            background: var(--wfca-bg-hover);
            border-bottom: 1px solid var(--wfca-border);
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--wfca-text-light);
        }

        .wfca-fw__table-header span {
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 2px;
        }

        .wfca-fw__table-header span:hover {
            color: var(--wfca-text);
        }

        .wfca-fw__sort-icon {
            font-size: 8px;
        }

        /* Fire list */
        .wfca-fw__list {
            list-style: none;
            margin: 0;
            padding: 0;
            max-height: 350px;
            overflow-y: auto;
        }

        .wfca-fw__item {
            display: grid;
            grid-template-columns: 1.5fr 70px 1fr 60px;
            gap: 4px;
            padding: 6px 10px;
            border-bottom: 1px solid var(--wfca-border);
            transition: background-color 0.15s ease;
            align-items: center;
        }

        .wfca-fw__item:last-child {
            border-bottom: none;
        }

        .wfca-fw__item:hover {
            background: var(--wfca-bg-hover);
        }

        .wfca-fw__name {
            font-weight: 500;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .wfca-fw__link {
            color: var(--wfca-link);
            text-decoration: none;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 12px;
        }

        .wfca-fw__link:hover {
            text-decoration: underline;
        }

        .wfca-fw__updated {
            color: var(--wfca-text-light);
            font-size: 10px;
            white-space: nowrap;
        }

        .wfca-fw__location {
            color: var(--wfca-text);
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .wfca-fw__size {
            text-align: left;
        }

        .wfca-fw__acres {
            display: inline-block;
            background: var(--wfca-primary);
            color: #fff;
            font-size: 10px;
            font-weight: 600;
            padding: 1px 4px;
            border-radius: 3px;
            white-space: nowrap;
        }

        .wfca-fw__acres--small {
            background: #ff9800;
        }

        .wfca-fw__acres--medium {
            background: #f57c00;
        }

        .wfca-fw__acres--large {
            background: #d32f2f;
        }

        .wfca-fw__acres--mega {
            background: #b71c1c;
        }

        /* Pagination */
        .wfca-fw__pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-top: 1px solid var(--wfca-border);
            background: var(--wfca-bg);
        }

        .wfca-fw__page-btn {
            padding: 3px 8px;
            border: 1px solid var(--wfca-border);
            border-radius: 3px;
            background: var(--wfca-bg);
            color: var(--wfca-text);
            cursor: pointer;
            font-size: 11px;
        }

        .wfca-fw__page-btn:hover:not(:disabled) {
            background: var(--wfca-bg-hover);
            border-color: var(--wfca-primary);
        }

        .wfca-fw__page-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .wfca-fw__page-info {
            font-size: 11px;
            color: var(--wfca-text-light);
        }

        /* Footer */
        .wfca-fw__footer {
            padding: 5px 10px;
            background: var(--wfca-bg-hover);
            font-size: 10px;
            color: var(--wfca-text-light);
            text-align: center;
            border-top: 1px solid var(--wfca-border);
        }

        .wfca-fw__footer a {
            color: var(--wfca-text-light);
            text-decoration: none;
        }

        .wfca-fw__footer a:hover {
            text-decoration: underline;
        }

        /* States */
        .wfca-fw__loading,
        .wfca-fw__error,
        .wfca-fw__empty {
            padding: 24px 16px;
            text-align: center;
            color: var(--wfca-text-light);
        }

        .wfca-fw__error {
            color: var(--wfca-primary);
        }

        /* Spinner */
        .wfca-fw__spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid var(--wfca-border);
            border-top-color: var(--wfca-primary);
            border-radius: 50%;
            animation: wfca-spin 0.8s linear infinite;
        }

        @keyframes wfca-spin {
            to { transform: rotate(360deg); }
        }

        /* Responsive */
        @media (max-width: 500px) {
            .wfca-fw__table-header,
            .wfca-fw__item {
                grid-template-columns: 1fr 1fr;
            }
            .wfca-fw__table-header span:nth-child(2),
            .wfca-fw__table-header span:nth-child(3),
            .wfca-fw__updated,
            .wfca-fw__location {
                display: none;
            }
        }

        /* Embed link in footer */
        .wfca-fw__embed-link {
            cursor: pointer;
            text-decoration: underline;
            margin-left: 4px;
        }

        .wfca-fw__embed-link:hover {
            color: var(--wfca-primary);
        }

        /* Embed Modal */
        .wfca-fw-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
            padding: 20px;
        }

        .wfca-fw-modal {
            background: #fff;
            border-radius: 12px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .wfca-fw-modal__header {
            background: linear-gradient(135deg, #d32f2f 0%, #f57c00 100%);
            color: #fff;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 12px 12px 0 0;
        }

        .wfca-fw-modal__title {
            font-size: 18px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .wfca-fw-modal__close {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: #fff;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
        }

        .wfca-fw-modal__close:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .wfca-fw-modal__body {
            padding: 20px;
        }

        .wfca-fw-modal__section {
            margin-bottom: 20px;
        }

        .wfca-fw-modal__section:last-child {
            margin-bottom: 0;
        }

        .wfca-fw-modal__label {
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            display: block;
            font-size: 14px;
        }

        .wfca-fw-modal__desc {
            color: #666;
            font-size: 13px;
            margin-bottom: 10px;
        }

        .wfca-fw-modal__code {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 12px 14px;
            border-radius: 6px;
            font-family: 'SF Mono', Monaco, 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.5;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
            position: relative;
        }

        .wfca-fw-modal__copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: #444;
            color: #fff;
            border: none;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .wfca-fw-modal__copy-btn:hover {
            background: #555;
        }

        .wfca-fw-modal__copy-btn--copied {
            background: #4caf50;
        }

        .wfca-fw-modal__options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }

        .wfca-fw-modal__option {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .wfca-fw-modal__option label {
            font-size: 12px;
            color: #666;
        }

        .wfca-fw-modal__option select,
        .wfca-fw-modal__option input {
            padding: 8px 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 13px;
            background: #fff;
        }

        .wfca-fw-modal__option select:focus,
        .wfca-fw-modal__option input:focus {
            outline: none;
            border-color: #d32f2f;
        }

        .wfca-fw-modal__preview {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 16px;
            background: #f9f9f9;
        }

        .wfca-fw-modal__preview-label {
            font-size: 11px;
            text-transform: uppercase;
            color: #999;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .wfca-fw-modal__footer {
            padding: 16px 20px;
            background: #f5f5f5;
            border-radius: 0 0 12px 12px;
            font-size: 12px;
            color: #666;
            text-align: center;
        }

        .wfca-fw-modal__footer a {
            color: #1976d2;
            text-decoration: none;
        }

        .wfca-fw-modal__footer a:hover {
            text-decoration: underline;
        }
    `;

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================
    
    /**
     * Inject styles into document head (once)
     */
    function injectStyles() {
        if (document.getElementById('wfca-fw-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'wfca-fw-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }
    
    /**
     * Format acreage for display (e.g., "2,500" or "12.5K")
     * @param {number|null} acres Raw acreage number
     * @returns {string} Formatted acreage string
     */
    function formatAcres(acres) {
        if (!acres && acres !== 0) return '-';

        if (acres >= 100000) {
            return (acres / 1000).toFixed(0) + 'K';
        } else if (acres >= 10000) {
            return (acres / 1000).toFixed(1) + 'K';
        } else {
            return acres.toLocaleString();
        }
    }

    /**
     * Get size class for acreage badge coloring
     * @param {number|null} acres
     * @returns {string} CSS class suffix
     */
    function getAcresSizeClass(acres) {
        if (!acres) return '';
        if (acres < 100) return 'small';
        if (acres < 1000) return 'medium';
        if (acres < 10000) return 'large';
        return 'mega';
    }

    /**
     * Format location string (county, state)
     * @param {string|null} county
     * @param {string|null} state
     * @returns {string} Formatted location
     */
    function formatLocation(county, state) {
        // Clean up state code (remove "US-" prefix if present)
        const cleanState = state ? state.replace('US-', '') : '';
        if (county && cleanState) return `${county}, ${cleanState}`;
        if (cleanState) return cleanState;
        if (county) return county;
        return '-';
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     * @param {string} dateStr ISO date string
     * @returns {string} Formatted relative time
     */
    function formatRelativeTime(dateStr) {
        if (!dateStr) return '-';

        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} str Input string
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Sort fires array by field
     * @param {Array} fires Array of fire objects
     * @param {string} field Field to sort by
     * @param {string} direction 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    function sortFires(fires, field, direction) {
        return [...fires].sort((a, b) => {
            let valA, valB;

            switch (field) {
                case 'name':
                    valA = (a.name || '').toLowerCase();
                    valB = (b.name || '').toLowerCase();
                    break;
                case 'updated':
                    valA = new Date(a.updated || 0).getTime();
                    valB = new Date(b.updated || 0).getTime();
                    break;
                case 'location':
                    valA = formatLocation(a.county, a.state).toLowerCase();
                    valB = formatLocation(b.county, b.state).toLowerCase();
                    break;
                case 'acres':
                    valA = a.acres || 0;
                    valB = b.acres || 0;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * State/territory code to full name mapping
     */
    const STATE_NAMES = {
        // 50 US States
        'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas',
        'CA': 'california', 'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware',
        'FL': 'florida', 'GA': 'georgia', 'HI': 'hawaii', 'ID': 'idaho',
        'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa', 'KS': 'kansas',
        'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
        'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi',
        'MO': 'missouri', 'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada',
        'NH': 'new hampshire', 'NJ': 'new jersey', 'NM': 'new mexico', 'NY': 'new york',
        'NC': 'north carolina', 'ND': 'north dakota', 'OH': 'ohio', 'OK': 'oklahoma',
        'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode island', 'SC': 'south carolina',
        'SD': 'south dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah',
        'VT': 'vermont', 'VA': 'virginia', 'WA': 'washington', 'WV': 'west virginia',
        'WI': 'wisconsin', 'WY': 'wyoming',
        // US Territories
        'PR': 'puerto rico', 'VI': 'virgin islands', 'GU': 'guam',
        'AS': 'american samoa', 'MP': 'northern mariana islands',
        'DC': 'district of columbia', 'WPI': 'west pacific islands'
    };

    /**
     * Filter fires by search term
     * @param {Array} fires Array of fire objects
     * @param {string} term Search term
     * @returns {Array} Filtered array
     */
    function filterFires(fires, term) {
        if (!term) return fires;
        const lowerTerm = term.toLowerCase().trim();

        return fires.filter(fire => {
            const name = (fire.name || '').toLowerCase();
            const county = (fire.county || '').toLowerCase();

            // Get clean state code (remove US- prefix)
            const stateCode = (fire.state || '').replace('US-', '').toUpperCase();
            const stateCodeLower = stateCode.toLowerCase();
            const stateName = STATE_NAMES[stateCode] || '';

            // Match against: name, county, state code, or full state name
            return name.includes(lowerTerm) ||
                   county.includes(lowerTerm) ||
                   stateCodeLower.includes(lowerTerm) ||
                   stateName.includes(lowerTerm);
        });
    }

    // ========================================================================
    // RENDERING
    // ========================================================================
    
    /**
     * Render the widget with fire data
     * @param {HTMLElement} container Widget container
     * @param {Object} data API response data
     * @param {Object} options Widget options
     * @param {Object} state Current widget state (sort, filter, page)
     * @param {Function} onFilterChange Callback when filter changes (to reload from API)
     */
    function renderWidget(container, data, options, state = {}, onFilterChange = null) {
        const { fires, meta } = data;
        const title = options.title || 'Active Wildfires';
        const perPage = options.perPage || 10;

        // Apply sorting (filtering is done server-side now)
        const sortField = state.sortField || 'acres';
        const sortDir = state.sortDir || 'desc';
        const filterTerm = state.filterTerm || '';
        const currentPage = state.page || 1;

        let displayFires = sortFires(fires, sortField, sortDir);

        // Pagination
        const totalFires = displayFires.length;
        const totalPages = Math.ceil(totalFires / perPage);
        const startIdx = (currentPage - 1) * perPage;
        const endIdx = startIdx + perPage;
        const pagedFires = displayFires.slice(startIdx, endIdx);

        // Sort icon helper
        const sortIcon = (field) => {
            if (sortField !== field) return '';
            return sortDir === 'asc' ? '▲' : '▼';
        };

        // Build fire list HTML - table style: Name | Updated | Location | Acres
        const fireListHtml = pagedFires.length > 0
            ? pagedFires.map(fire => {
                const sizeClass = getAcresSizeClass(fire.acres);
                const acresHtml = fire.acres
                    ? `<span class="wfca-fw__acres wfca-fw__acres--${sizeClass}">${formatAcres(fire.acres)}</span>`
                    : '<span class="wfca-fw__acres">-</span>';

                return `
                <li class="wfca-fw__item">
                    <div class="wfca-fw__name">
                        <a href="${escapeHtml(fire.map_url)}"
                           class="wfca-fw__link"
                           target="_blank"
                           rel="noopener noreferrer"
                           title="View ${escapeHtml(fire.name)} on Fire Map">
                            ${escapeHtml(fire.name)}
                        </a>
                    </div>
                    <div class="wfca-fw__updated">${formatRelativeTime(fire.updated)}</div>
                    <div class="wfca-fw__location">${escapeHtml(formatLocation(fire.county, fire.state))}</div>
                    <div class="wfca-fw__size">${acresHtml}</div>
                </li>
            `}).join('')
            : `<li class="wfca-fw__empty">No fires active in last 7d${filterTerm ? '<br>for \'' + escapeHtml(filterTerm) + '\'' : ''}</li>`;

        // Build pagination HTML
        const paginationHtml = totalPages > 1
            ? `<div class="wfca-fw__pagination">
                   <button class="wfca-fw__page-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
                   <span class="wfca-fw__page-info">Page ${currentPage} of ${totalPages}</span>
                   <button class="wfca-fw__page-btn" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>Next →</button>
               </div>`
            : '';

        // Build footer with embed link
        const footerHtml = options.showTime !== false
            ? `<div class="wfca-fw__footer">
                   Data from <a href="${CONFIG.fireMapUrl}" target="_blank" rel="noopener">WFCA Fire Map</a>
                   &middot; ${totalFires} fires &middot; Updated ${new Date(meta.generated_at).toLocaleTimeString()}
                   &middot; <span class="wfca-fw__embed-link" data-action="embed">[Embed]</span>
               </div>`
            : '';

        container.innerHTML = `
            <div class="wfca-fw ${options.theme === 'dark' ? 'wfca-fw--dark' : ''} ${options.compact ? 'wfca-fw--compact' : ''}">
                <div class="wfca-fw__header">
                    <span class="wfca-fw__title">
                        <a href="${CONFIG.fireMapUrl}" target="_blank" rel="noopener">${escapeHtml(title)}</a>
                    </span>
                    <span class="wfca-fw__count">${totalFires}</span>
                </div>
                <div class="wfca-fw__controls">
                    <input type="text"
                           class="wfca-fw__filter"
                           placeholder="Filter by state or fire name..."
                           value="${escapeHtml(filterTerm)}"
                           data-action="filter">
                </div>
                <div class="wfca-fw__table-header">
                    <span data-sort="name">Name <span class="wfca-fw__sort-icon">${sortIcon('name')}</span></span>
                    <span data-sort="updated">Updated <span class="wfca-fw__sort-icon">${sortIcon('updated')}</span></span>
                    <span data-sort="location">Location <span class="wfca-fw__sort-icon">${sortIcon('location')}</span></span>
                    <span data-sort="acres">Acres <span class="wfca-fw__sort-icon">${sortIcon('acres')}</span></span>
                </div>
                <ul class="wfca-fw__list">
                    ${fireListHtml}
                </ul>
                ${paginationHtml}
                ${footerHtml}
            </div>
        `;

        // Attach event listeners for sorting
        container.querySelectorAll('[data-sort]').forEach(el => {
            el.addEventListener('click', () => {
                const field = el.dataset.sort;
                let newDir = 'desc';
                if (state.sortField === field) {
                    newDir = state.sortDir === 'desc' ? 'asc' : 'desc';
                }
                renderWidget(container, data, options, {
                    ...state,
                    sortField: field,
                    sortDir: newDir,
                    page: 1, // Reset to page 1 on sort change
                }, onFilterChange);
            });
        });

        // Attach event listeners for pagination
        container.querySelectorAll('[data-page]').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.dataset.page;
                let newPage = currentPage;
                if (action === 'prev' && currentPage > 1) newPage--;
                if (action === 'next' && currentPage < totalPages) newPage++;
                if (newPage !== currentPage) {
                    renderWidget(container, data, options, {
                        ...state,
                        page: newPage,
                    }, onFilterChange);
                }
            });
        });

        // Attach event listener for filtering - triggers API reload
        const filterInput = container.querySelector('[data-action="filter"]');
        if (filterInput) {
            let debounceTimer;
            filterInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    const newFilter = e.target.value.trim();
                    if (onFilterChange) {
                        // Reload from API with new filter
                        onFilterChange(newFilter);
                    }
                }, 500); // Longer debounce for API calls
            });
            // Restore focus and cursor position
            if (filterTerm) {
                filterInput.focus();
                filterInput.setSelectionRange(filterTerm.length, filterTerm.length);
            }
        }

        // Attach event listener for embed link
        const embedLink = container.querySelector('[data-action="embed"]');
        if (embedLink) {
            embedLink.addEventListener('click', () => {
                showEmbedModal(options);
            });
        }
    }

    // ========================================================================
    // EMBED MODAL
    // ========================================================================

    /**
     * Show the embed code modal
     * @param {Object} currentOptions Current widget options for defaults
     */
    function showEmbedModal(currentOptions = {}) {
        // Remove any existing modal
        const existingModal = document.querySelector('.wfca-fw-modal-overlay');
        if (existingModal) existingModal.remove();

        // Get the script URL (try to detect from current script or use production URL)
        const scriptUrl = getScriptUrl();

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'wfca-fw-modal-overlay';
        overlay.innerHTML = `
            <div class="wfca-fw-modal">
                <div class="wfca-fw-modal__header">
                    <span class="wfca-fw-modal__title">
                        <span>🔥</span> Embed Active Fires Widget
                    </span>
                    <button class="wfca-fw-modal__close" data-action="close">&times;</button>
                </div>
                <div class="wfca-fw-modal__body">
                    <div class="wfca-fw-modal__section">
                        <span class="wfca-fw-modal__label">Customize Your Widget</span>
                        <p class="wfca-fw-modal__desc">Configure the widget options below, then copy the embed code.</p>
                        <div class="wfca-fw-modal__options">
                            <div class="wfca-fw-modal__option">
                                <label>Theme</label>
                                <select id="wfca-embed-theme">
                                    <option value="light" ${currentOptions.theme !== 'dark' ? 'selected' : ''}>Light</option>
                                    <option value="dark" ${currentOptions.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                </select>
                            </div>
                            <div class="wfca-fw-modal__option">
                                <label>Max Fires</label>
                                <select id="wfca-embed-limit">
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50" selected>50</option>
                                </select>
                            </div>
                            <div class="wfca-fw-modal__option">
                                <label>Compact Mode</label>
                                <select id="wfca-embed-compact">
                                    <option value="false" ${!currentOptions.compact ? 'selected' : ''}>No</option>
                                    <option value="true" ${currentOptions.compact ? 'selected' : ''}>Yes (Sidebar)</option>
                                </select>
                            </div>
                            <div class="wfca-fw-modal__option">
                                <label>Pre-filter (optional)</label>
                                <input type="text" id="wfca-embed-query" placeholder="e.g., CA or Texas" value="">
                            </div>
                            <div class="wfca-fw-modal__option">
                                <label>Custom Title (optional)</label>
                                <input type="text" id="wfca-embed-title" placeholder="Active Wildfires" value="">
                            </div>
                        </div>
                    </div>

                    <div class="wfca-fw-modal__section">
                        <span class="wfca-fw-modal__label">Embed Code</span>
                        <p class="wfca-fw-modal__desc">Copy and paste this code into your website's HTML.</p>
                        <div class="wfca-fw-modal__code" style="position: relative;">
                            <button class="wfca-fw-modal__copy-btn" data-action="copy">Copy</button>
                            <code id="wfca-embed-code"></code>
                        </div>
                    </div>

                    <div class="wfca-fw-modal__section">
                        <span class="wfca-fw-modal__label">Preview</span>
                        <div class="wfca-fw-modal__preview">
                            <div class="wfca-fw-modal__preview-label">Live Preview</div>
                            <div id="wfca-embed-preview" style="max-width: 360px;"></div>
                        </div>
                    </div>
                </div>
                <div class="wfca-fw-modal__footer">
                    Powered by <a href="https://fire-map.wfca.com" target="_blank" rel="noopener">WFCA Fire Map</a>
                    &middot; <a href="https://wfca.com" target="_blank" rel="noopener">Western Fire Chiefs Association</a>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Get elements
        const modal = overlay.querySelector('.wfca-fw-modal');
        const codeElement = document.getElementById('wfca-embed-code');
        const previewElement = document.getElementById('wfca-embed-preview');
        const themeSelect = document.getElementById('wfca-embed-theme');
        const limitSelect = document.getElementById('wfca-embed-limit');
        const compactSelect = document.getElementById('wfca-embed-compact');
        const queryInput = document.getElementById('wfca-embed-query');
        const titleInput = document.getElementById('wfca-embed-title');
        const copyBtn = overlay.querySelector('[data-action="copy"]');
        const closeBtn = overlay.querySelector('[data-action="close"]');

        // Generate embed code function
        function generateEmbedCode() {
            const theme = themeSelect.value;
            const limit = limitSelect.value;
            const compact = compactSelect.value;
            const query = queryInput.value.trim();
            const title = titleInput.value.trim();

            let attrs = `data-limit="${limit}"`;
            if (theme === 'dark') attrs += ` data-theme="dark"`;
            if (compact === 'true') attrs += ` data-compact="true"`;
            if (query) attrs += ` data-query="${escapeHtml(query)}"`;
            if (title) attrs += ` data-title="${escapeHtml(title)}"`;

            const code = `<!-- WFCA Active Fires Widget -->
<div id="wfca-fire-widget" ${attrs}></div>
<script src="${scriptUrl}" async><\/script>`;

            return code;
        }

        // Update code display and preview
        function updateEmbed() {
            const code = generateEmbedCode();
            codeElement.textContent = code;

            // Update preview
            const theme = themeSelect.value;
            const limit = limitSelect.value;
            const compact = compactSelect.value;
            const query = queryInput.value.trim();
            const title = titleInput.value.trim();

            previewElement.innerHTML = '';
            const previewDiv = document.createElement('div');
            previewDiv.setAttribute('data-wfca-widget', 'fire');
            previewDiv.setAttribute('data-limit', Math.min(parseInt(limit), 5).toString()); // Limit preview to 5
            previewDiv.setAttribute('data-theme', theme);
            if (compact === 'true') previewDiv.setAttribute('data-compact', 'true');
            if (query) previewDiv.setAttribute('data-query', query);
            if (title) previewDiv.setAttribute('data-title', title);
            previewElement.appendChild(previewDiv);

            // Initialize the preview widget
            initWidget(previewDiv);
        }

        // Initial update
        updateEmbed();

        // Listen for option changes
        [themeSelect, limitSelect, compactSelect, queryInput, titleInput].forEach(el => {
            el.addEventListener('change', updateEmbed);
            el.addEventListener('input', updateEmbed);
        });

        // Copy button
        copyBtn.addEventListener('click', async () => {
            const code = generateEmbedCode();
            try {
                await navigator.clipboard.writeText(code);
                copyBtn.textContent = 'Copied!';
                copyBtn.classList.add('wfca-fw-modal__copy-btn--copied');
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                    copyBtn.classList.remove('wfca-fw-modal__copy-btn--copied');
                }, 2000);
            } catch (err) {
                // Fallback for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = code;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
            }
        });

        // Close modal
        function closeModal() {
            overlay.remove();
        }

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }

    /**
     * Get the script URL for embedding
     * @returns {string} Script URL
     */
    function getScriptUrl() {
        // Try to find current script
        const scripts = document.querySelectorAll('script[src*="fire-widget"]');
        if (scripts.length > 0) {
            const src = scripts[scripts.length - 1].src;
            // If it's localhost, return production URL
            if (src.includes('localhost')) {
                return 'https://wfca.com/widgets/fire-widget.js';
            }
            return src;
        }
        // Default to production URL
        return 'https://wfca.com/widgets/fire-widget.js';
    }

    /**
     * Render loading state
     * @param {HTMLElement} container Widget container
     * @param {Object} options Widget options
     */
    function renderLoading(container, options) {
        container.innerHTML = `
            <div class="wfca-fw ${options.theme === 'dark' ? 'wfca-fw--dark' : ''}">
                <div class="wfca-fw__header">
                    <span class="wfca-fw__title">🔥 Loading...</span>
                </div>
                <div class="wfca-fw__loading">
                    <span class="wfca-fw__spinner"></span>
                </div>
            </div>
        `;
    }
    
    /**
     * Render error state
     * @param {HTMLElement} container Widget container
     * @param {string} message Error message
     * @param {Object} options Widget options
     */
    function renderError(container, message, options) {
        container.innerHTML = `
            <div class="wfca-fw ${options.theme === 'dark' ? 'wfca-fw--dark' : ''}">
                <div class="wfca-fw__header">
                    <span class="wfca-fw__title">🔥 Active Wildfires</span>
                </div>
                <div class="wfca-fw__error">
                    ${escapeHtml(message)}
                    <br><small>Please try again later</small>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // API
    // ========================================================================
    
    /**
     * Resolve state filter to API state code
     * @param {string} filter User input filter
     * @returns {string} State code for API (e.g., "CA") or empty string
     */
    function resolveStateFilter(filter) {
        if (!filter) return '';
        const lowerFilter = filter.toLowerCase().trim();

        // Check if it's a state code (2 letters)
        const upperFilter = filter.toUpperCase().trim();
        if (upperFilter.length === 2 && STATE_NAMES[upperFilter]) {
            return upperFilter;
        }

        // Check if it matches a state name
        for (const [code, name] of Object.entries(STATE_NAMES)) {
            if (name === lowerFilter || name.startsWith(lowerFilter)) {
                return code;
            }
        }

        return ''; // No state match - could be a fire name search
    }

    /**
     * Fetch fire data from API
     * @param {Object} options Fetch options
     * @returns {Promise<Object>} API response
     */
    async function fetchFires(options) {
        const params = new URLSearchParams({
            limit: options.limit || 50, // Fetch more for client-side pagination
        });

        // Check if filter matches a state, otherwise treat as name search
        if (options.filterState) {
            const stateCode = resolveStateFilter(options.filterState);
            if (stateCode) {
                params.set('state', stateCode);
            } else if (options.filterState.length >= 2) {
                // Not a state - use as name search
                params.set('search', options.filterState);
            }
        }

        const response = await fetch(`${CONFIG.apiUrl}?${params}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * Fetch and render widget
     * @param {HTMLElement} container Widget container
     * @param {Object} options Widget options
     * @param {Object} state Current state
     */
    async function loadWidget(container, options, state = {}) {
        try {
            const fetchOptions = {
                ...options,
                filterState: state.filterTerm || '',
            };
            const data = await fetchFires(fetchOptions);

            // Create filter change callback
            const onFilterChange = (newFilter) => {
                renderLoading(container, options);
                loadWidget(container, options, { filterTerm: newFilter });
            };

            renderWidget(container, data, options, state, onFilterChange);
        } catch (error) {
            console.error('[WFCA Fire Widget]', error);
            renderError(container, 'Unable to load fire data', options);
        }
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    /**
     * Parse options from data attributes
     * @param {HTMLElement} container Widget container
     * @returns {Object} Parsed options
     */
    function parseOptions(container) {
        return {
            limit: parseInt(container.dataset.limit, 10) || 10,
            state: container.dataset.state || '',
            theme: container.dataset.theme || 'light',
            title: container.dataset.title || '',
            showTime: container.dataset.showTime !== 'false',
            compact: container.dataset.compact === 'true',
            query: container.dataset.query || '',
        };
    }
    
    /**
     * Initialize a widget instance
     * @param {HTMLElement|string} containerOrId Container element or ID
     */
    function initWidget(containerOrId) {
        const container = typeof containerOrId === 'string'
            ? document.getElementById(containerOrId)
            : containerOrId;
        
        if (!container) {
            console.warn('[WFCA Fire Widget] Container not found');
            return;
        }
        
        // Mark as initialized to prevent double-init
        if (container.dataset.wfcaInit === 'true') return;
        container.dataset.wfcaInit = 'true';
        
        injectStyles();
        
        const options = parseOptions(container);
        
        // Initial load (with optional preloaded query)
        const initialState = options.query ? { filterTerm: options.query } : {};
        renderLoading(container, options);
        loadWidget(container, options, initialState);
        
        // Auto-refresh
        setInterval(() => loadWidget(container, options), CONFIG.refreshInterval);
    }
    
    /**
     * Initialize all widgets on page
     */
    function initAll() {
        // Find default container
        const defaultContainer = document.getElementById(CONFIG.containerId);
        if (defaultContainer) {
            initWidget(defaultContainer);
        }
        
        // Find all containers with data-wfca-widget attribute
        document.querySelectorAll('[data-wfca-widget="fire"]').forEach(initWidget);
    }
    
    // ========================================================================
    // EXPORTS & AUTO-INIT
    // ========================================================================
    
    // Expose for external initialization (e.g., dynamic widgets)
    window.WFCAFireWidget = {
        init: initWidget,
        initAll: initAll,
        showEmbedModal: showEmbedModal,
        config: CONFIG,
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
    
})();
