import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import playwright from '../config-ui/node_modules/playwright/index.js';

const { chromium } = playwright;

const baseUrl = process.env.MCP_CONFIG_UI_URL ?? 'http://127.0.0.1:3008';
const username = process.env.MCP_CONFIG_UI_USERNAME ?? 'admin';
const password = process.env.MCP_CONFIG_UI_PASSWORD ?? 'changeme';
const chromePath = process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('docs/src/images/config-ui');
const authStorageKey = 'mcp_config_token';

const shots = [
  {
    name: 'overview-dark.png',
    route: '/',
    waitFor: { type: 'text', value: 'Configuration at a glance' },
  },
  {
    name: 'instances-dark.png',
    route: '/#/instances',
    waitFor: { type: 'text', value: 'Configured instances' },
    beforeNavigation(page) {
      return page.addInitScript(() => {
        window.localStorage.setItem('mcp_instances_view', 'card');
      });
    },
  },
  {
    name: 'instances-table-dark.png',
    route: '/#/instances',
    waitFor: { type: 'text', value: 'Configured instances' },
    async afterNavigation(page) {
      await page.evaluate(() => {
        window.localStorage.setItem('mcp_instances_view', 'table');
      });
      await page.goto(`${baseUrl}/#/instances`, { waitUntil: 'networkidle' });
      await page.getByText('Configured instances', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
      const tableToggleCandidates = [
        page.locator('label').filter({ hasText: /^Table$/ }).first(),
        page.locator('button').filter({ hasText: /^Table$/ }).first(),
        page.getByText('Table', { exact: true }).first(),
      ];
      for (const candidate of tableToggleCandidates) {
        try {
          if (await candidate.isVisible({ timeout: 2000 }).catch(() => false)) {
            await candidate.click({ timeout: 2000 });
            break;
          }
        } catch {
          // Try the next candidate.
        }
      }
      await page.getByText('Database', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.getByPlaceholder('Search DB').waitFor({ state: 'visible', timeout: 15000 });
    },
  },
  {
    name: 'add-instance-dark.png',
    route: '/#/instances',
    waitFor: { type: 'text', value: 'Configured instances' },
    async afterNavigation(page) {
      await page.getByRole('button', { name: 'Add instance' }).click();
      await page.getByText('Create a new instance connection', { exact: false }).first().waitFor({
        state: 'visible',
        timeout: 15000,
      });
      await page.getByLabel('Instance name').waitFor({ state: 'visible', timeout: 15000 });
    },
  },
  {
    name: 'tools-dark.png',
    route: '/#/tools',
    waitFor: { type: 'text', value: 'Manage the live MCP catalog' },
  },
  {
    name: 'prompts-dark.png',
    route: '/#/prompts',
    waitFor: { type: 'text', value: 'System prompts' },
  },
  {
    name: 'server-dark.png',
    route: '/#/server',
    waitFor: { type: 'text', value: 'Server configuration' },
  },
  {
    name: 'security-dark.png',
    route: '/#/security',
    waitFor: { type: 'text', value: 'Passwords and transport auth' },
  },
];

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Login failed (${response.status}): ${message}`);
  }

  const payload = await response.json();
  if (!payload?.token) {
    throw new Error('Login succeeded but no session token was returned.');
  }

  return payload.token;
}

async function waitForReadyState(page, rule) {
  if (rule.type === 'text') {
    await page.getByText(rule.value, { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
    return;
  }

  throw new Error(`Unsupported wait rule: ${rule.type}`);
}

async function capture() {
  await mkdir(outputDir, { recursive: true });
  const token = await login();

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });

  const context = await browser.newContext({
    viewport: { width: 1720, height: 1180 },
    deviceScaleFactor: 2,
  });

  await context.addInitScript(([storageKey, sessionToken]) => {
    window.localStorage.setItem(storageKey, sessionToken);
    window.localStorage.setItem('mcp_shell_sidebar_collapsed', 'false');
  }, [authStorageKey, token]);

  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });

  for (const shot of shots) {
    if (shot.beforeNavigation) {
      await shot.beforeNavigation(page);
    }

    await page.goto(`${baseUrl}${shot.route}`, { waitUntil: 'networkidle' });
    await waitForReadyState(page, shot.waitFor);
    if (shot.afterNavigation) {
      await shot.afterNavigation(page);
    }
    await page.screenshot({
      path: path.join(outputDir, shot.name),
      type: 'png',
      fullPage: false,
    });
  }

  await context.close();
  await browser.close();
}

capture().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
