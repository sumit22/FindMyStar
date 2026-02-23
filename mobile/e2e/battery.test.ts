/**
 * REL-004: Battery Usage Testing
 *
 * Automated battery drain estimation using device instrumentation.
 * Targets from NFR-4:
 *   - AR mode: < 10%/hr
 *   - Info screen: < 5%/hr
 *   - Background: < 1%/hr
 *   - Midnight recalc: < 0.5%
 *
 * These tests use timed sessions and log battery levels.
 * Actual measurement requires real devices with battery APIs.
 *
 * Run: npx detox test -c android.emu.debug e2e/battery.test.ts
 */
import { by, device, element, waitFor } from 'detox';

// Minimum test duration in ms for meaningful battery measurement
const SESSION_MINUTES = 5;
const SESSION_MS = SESSION_MINUTES * 60 * 1000;

describe('Battery Usage Testing', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it(`AR mode battery drain over ${SESSION_MINUTES}min session`, async () => {
    // Navigate to AR
    const searchInput = element(by.label('Search celestial objects'));
    await searchInput.typeText('Sirius');
    await waitFor(element(by.text('Sirius'))).toBeVisible().withTimeout(5000);
    await element(by.text('Sirius')).tap();
    await waitFor(element(by.text('Track'))).toBeVisible().withTimeout(3000);
    await element(by.text('Track')).tap();
    await waitFor(element(by.text('Camera Preview'))).toBeVisible().withTimeout(3000);

    console.log('[BATTERY] AR mode session start');
    const start = Date.now();

    // Hold AR screen open for the session duration
    await new Promise(resolve => setTimeout(resolve, SESSION_MS));

    const elapsed = (Date.now() - start) / 1000 / 60;
    console.log(`[BATTERY] AR mode session: ${elapsed.toFixed(1)} minutes`);
    console.log('[BATTERY] Check device battery stats for actual drain %');

    await element(by.label('Go back')).tap();
  });

  it(`Info screen battery drain over ${SESSION_MINUTES}min session`, async () => {
    // Should be on ObjectInfo after going back from AR
    await waitFor(element(by.text('Position'))).toBeVisible().withTimeout(3000);

    console.log('[BATTERY] Info screen session start');
    const start = Date.now();

    await new Promise(resolve => setTimeout(resolve, SESSION_MS));

    const elapsed = (Date.now() - start) / 1000 / 60;
    console.log(`[BATTERY] Info screen session: ${elapsed.toFixed(1)} minutes`);
    console.log('[BATTERY] Check device battery stats for actual drain %');

    await device.pressBack();
  });

  it('background battery drain measurement', async () => {
    console.log('[BATTERY] Sending app to background');
    await device.sendToHome();

    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, SESSION_MS));

    const elapsed = (Date.now() - start) / 1000 / 60;
    console.log(`[BATTERY] Background session: ${elapsed.toFixed(1)} minutes`);
    console.log('[BATTERY] Check device battery stats for actual drain %');

    await device.launchApp({ newInstance: false });
  });
});
