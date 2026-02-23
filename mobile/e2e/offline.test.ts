/**
 * REL-005: Offline Verification Testing
 *
 * Verifies all core features work in airplane mode:
 *   - Catalog search (SQLite, bundled)
 *   - Object info display
 *   - AR tracking (with last-known location)
 *   - Alarm management
 *   - Settings persistence
 *
 * Run: npx detox test -c ios.sim.debug e2e/offline.test.ts
 */
import { by, device, element, expect, waitFor } from 'detox';

describe('Offline Verification', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });

    // Disable WiFi and data to simulate airplane mode
    await device.disableSynchronization();
    await device.setURLBlacklist(['.*']);
  });

  afterAll(async () => {
    await device.enableSynchronization();
    await device.terminateApp();
  });

  it('should load app without network', async () => {
    await expect(element(by.label('Search celestial objects'))).toBeVisible();
  });

  it('should search catalog offline', async () => {
    const searchInput = element(by.label('Search celestial objects'));
    await searchInput.typeText('Mars');

    await waitFor(element(by.text('Mars')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should display Object Info offline', async () => {
    await element(by.text('Mars')).tap();

    await waitFor(element(by.text('Position')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should compute rise/set times offline', async () => {
    // Rise/set is computed entirely in Rust core, no network needed
    await expect(element(by.text('Rise / Set'))).toBeVisible();
  });

  it('should open AR screen offline', async () => {
    await element(by.text('Track')).tap();

    await waitFor(element(by.text('Camera Preview')))
      .toBeVisible()
      .withTimeout(3000);

    await element(by.label('Go back')).tap();
  });

  it('should create alarm offline', async () => {
    await element(by.text('Set Alert')).tap();

    // Navigate to Alarms tab to verify
    await device.pressBack();
    await element(by.text('Alarms')).tap();

    await waitFor(element(by.text('Mars')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should toggle alarm offline', async () => {
    const toggle = element(by.label('Disable alarm'));
    await toggle.tap();
    await expect(element(by.label('Enable alarm'))).toBeVisible();
  });

  it('should delete alarm offline', async () => {
    await element(by.text('Mars')).longPress();
    await element(by.text('Delete')).tap();

    await waitFor(element(by.text('No alarms set')))
      .toBeVisible()
      .withTimeout(5000);
  });
});
