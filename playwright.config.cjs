const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  testMatch: 'browser.spec.cjs',
  fullyParallel: false,
  workers: 1,
  timeout: 20000,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173/',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 1000 },
    locale: 'ko-KR',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false
  }
});
