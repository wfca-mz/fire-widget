<?php require_once __DIR__ . '/config.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WFCA Fire Widget Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
        }
        .widget-container {
            max-width: 400px;
            margin: 20px 0;
        }
        .test-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h2 {
            margin-top: 0;
            color: #d32f2f;
        }
        .api-test {
            margin-top: 20px;
        }
        .api-test pre {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 12px;
            max-height: 400px;
        }
        .controls {
            margin-bottom: 15px;
        }
        button {
            background: #d32f2f;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background: #b71c1c;
        }
        .info {
            background: #e3f2fd;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h1>WFCA Active Fires Widget - Test Page</h1>

    <div class="info">
        <strong>Environment:</strong> <?= WFCA_ENVIRONMENT ?> |
        <strong>API:</strong> <?= WFCA_API_URL ?>
    </div>

    <div class="test-section">
        <h2>1. API Test</h2>
        <div class="controls">
            <button onclick="testApi(10)">Fetch 10 Fires</button>
            <button onclick="testApi(50)">Fetch 50 Fires</button>
        </div>
        <div class="api-test">
            <pre id="api-response">Click a button to test the API...</pre>
        </div>
    </div>

    <div class="test-section">
        <h2>2. Widget - Light Theme (50 fires, 10 per page)</h2>
        <div class="widget-container" style="max-width: 360px;">
            <div id="wfca-fire-widget"
                 data-limit="50"
                 data-theme="light"
                 data-title="Active Wildfires">
            </div>
        </div>
    </div>

    <div class="test-section" style="background: #1e1e1e;">
        <h2 style="color: #e0e0e0;">3. Widget - Dark Theme (50 fires, 10 per page)</h2>
        <div class="widget-container" style="max-width: 360px;">
            <div data-wfca-widget="fire"
                 data-limit="50"
                 data-theme="dark"
                 data-title="Active Wildfires">
            </div>
        </div>
    </div>

    <div class="test-section">
        <h2>4. Widget - Compact Mode</h2>
        <div class="widget-container" style="max-width: 300px;">
            <div data-wfca-widget="fire"
                 data-limit="5"
                 data-theme="light"
                 data-compact="true">
            </div>
        </div>
    </div>

    <!-- Inject config from PHP/.env -->
    <script>
        window.WFCA_API_URL = <?= json_encode(WFCA_API_URL) ?>;
        window.WFCA_FIRE_MAP_URL = <?= json_encode(WFCA_FIRE_MAP_URL) ?>;

        async function testApi(limit) {
            const pre = document.getElementById('api-response');
            pre.textContent = 'Loading...';

            try {
                const response = await fetch(`${window.WFCA_API_URL}?limit=${limit}`);
                const data = await response.json();
                pre.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                pre.textContent = 'Error: ' + error.message + '\n\nMake sure the PHP server is running:\nphp -S localhost:8080';
            }
        }
    </script>

    <!-- Load the widget (picks up window.WFCA_API_URL) -->
    <script src="fire-widget.js"></script>
</body>
</html>
