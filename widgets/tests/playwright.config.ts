import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load .env from private_html
const envPath = path.resolve(__dirname, '../../private_html/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Server configuration from .env
const serverHost = process.env.DEV_SERVER_HOST || 'localhost';
const serverPort = process.env.DEV_SERVER_PORT || '8888';
const baseURL = `http://${serverHost}:${serverPort}`;

export default defineConfig({
  testDir: './',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  timeout: 30000,

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `php -S ${serverHost}:${serverPort} -t ${path.resolve(__dirname, '..')}`,
    url: `${baseURL}/test.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 10000,
  },
});
