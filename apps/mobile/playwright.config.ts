import { defineConfig, devices } from '@playwright/test';

/**
 * Composer and voice end-to-end tests against the exported web build (`npm run build:web`,
 * or E2E_DIST=<dir>), served locally with an SPA fallback. iPhone emulation with
 * touch in WebKit and Chromium. Every request off the local server is aborted in
 * the tests (the voice test route-mocks the turn, transcribe and speak endpoints),
 * so no backend is needed. Voice runs in Chromium only (fake microphone flags).
 */
const port = Number(process.env.E2E_PORT ?? 4173);
const iphone = devices['iPhone 17 Pro'];

export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'webkit-iphone', use: { ...iphone, browserName: 'webkit' } },
    {
      name: 'chromium-iphone',
      use: {
        ...iphone,
        browserName: 'chromium',
        // voice e2e: a fake microphone (a steady tone) that's granted without a prompt
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
      },
    },
  ],
  webServer: {
    command: `node e2e/serve.mjs ${process.env.E2E_DIST ?? 'dist-web'} ${port}`,
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
