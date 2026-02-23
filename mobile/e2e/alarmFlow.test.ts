/**
 * REL-002: E2E Test — Alarm Flow
 *
 * Tests the complete alarm journey:
 *   Search → Set Alert → Alarms tab → Toggle → Delete
 *
 * Run: npx detox test -c ios.sim.debug e2e/alarmFlow.test.ts
 */
import { by, device, element, expect, waitFor } from 'detox';

describe('Alarm Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  describe('Create alarm from Object Info', () => {
    it('should search for Jupiter', async () => {
      const searchInput = element(by.label('Search celestial objects'));
      await searchInput.typeText('Jupiter');

      await waitFor(element(by.text('Jupiter')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should navigate to ObjectInfo', async () => {
      await element(by.text('Jupiter')).tap();

      await waitFor(element(by.text('Position')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should create alarm via Set Alert button', async () => {
      await element(by.text('Set Alert')).tap();

      // Should show confirmation or stay on Object Info
      // The alarm is created asynchronously
      await waitFor(element(by.text('Position')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Alarms tab management', () => {
    it('should switch to Alarms tab', async () => {
      // Navigate back to tabs first
      await device.pressBack();
      await element(by.text('Alarms')).tap();

      // Should see the alarm we just created
      await waitFor(element(by.text('Jupiter')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show alarm details', async () => {
      await expect(element(by.text(/Next rise/))).toBeVisible();
      await expect(element(by.text(/Min alt/))).toBeVisible();
    });

    it('should toggle alarm off', async () => {
      const toggle = element(by.label('Disable alarm'));
      await toggle.tap();

      // Alarm should now show as disabled (reduced opacity)
      await expect(element(by.label('Enable alarm'))).toBeVisible();
    });

    it('should toggle alarm back on', async () => {
      const toggle = element(by.label('Enable alarm'));
      await toggle.tap();

      await expect(element(by.label('Disable alarm'))).toBeVisible();
    });

    it('should pull to refresh alarms', async () => {
      const list = element(by.type('RCTScrollView'));
      await list.swipe('down', 'slow', 0.5);

      // After refresh, alarms should still be visible
      await waitFor(element(by.text('Jupiter')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should navigate to ObjectInfo from alarm tap', async () => {
      await element(by.text('Jupiter')).tap();

      await waitFor(element(by.text('Position')))
        .toBeVisible()
        .withTimeout(3000);

      // Go back to Alarms
      await device.pressBack();
    });

    it('should delete alarm via long press', async () => {
      await element(by.text('Jupiter')).longPress();

      // Confirmation dialog
      await waitFor(element(by.text('Delete Alarm')))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.text('Delete')).tap();

      // Should show empty state
      await waitFor(element(by.text('No alarms set')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show search CTA on empty alarms', async () => {
      await expect(element(by.text('Search Objects'))).toBeVisible();
    });

    it('should navigate to search from empty alarms CTA', async () => {
      await element(by.text('Search Objects')).tap();

      await waitFor(element(by.label('Search celestial objects')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });
});
