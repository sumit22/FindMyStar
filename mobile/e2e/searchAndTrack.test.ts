/**
 * REL-001: E2E Test — Search & Track Flow
 *
 * Tests the complete user journey:
 *   Search → Select → Object Info → Track (AR) → Lock
 *
 * Run: npx detox test -c ios.sim.debug e2e/searchAndTrack.test.ts
 */
import { by, device, element, expect, waitFor } from 'detox';

describe('Search & Track Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('should display the search screen on launch', async () => {
    await expect(element(by.label('Search celestial objects'))).toBeVisible();
  });

  it('should show empty state hint before searching', async () => {
    await expect(element(by.text('Search for celestial objects by name'))).toBeVisible();
    await expect(element(by.text('Try "Sirius", "Jupiter", or "M31"'))).toBeVisible();
  });

  it('should search for Sirius and show results', async () => {
    const searchInput = element(by.label('Search celestial objects'));
    await searchInput.typeText('Sirius');

    // Wait for debounce + results
    await waitFor(element(by.text('Sirius')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show magnitude badge on results', async () => {
    await expect(element(by.text('Naked eye'))).toBeVisible();
  });

  it('should navigate to ObjectInfo when tapping a result', async () => {
    await element(by.text('Sirius')).tap();

    // Object Info screen should show position card
    await waitFor(element(by.text('Position')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should display rise/set times on ObjectInfo', async () => {
    await expect(element(by.text('Rise / Set'))).toBeVisible();
  });

  it('should navigate to AR screen when tapping Track', async () => {
    await element(by.text('Track')).tap();

    // AR screen should show the object name and camera placeholder
    await waitFor(element(by.text('Camera Preview')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show directional arrow on AR screen', async () => {
    // Arrow should be present with distance badge
    await waitFor(element(by.label(/Arrow pointing toward target/)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show alt/az info bar', async () => {
    await waitFor(element(by.label(/Alt:/)))
      .toExist()
      .withTimeout(3000);
  });

  it('should navigate back from AR screen', async () => {
    await element(by.label('Go back')).tap();

    // Should return to Object Info
    await waitFor(element(by.text('Position')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should navigate back to search', async () => {
    // Go back from Object Info
    await device.pressBack();

    await waitFor(element(by.label('Search celestial objects')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show no results for gibberish query', async () => {
    const searchInput = element(by.label('Search celestial objects'));
    await searchInput.clearText();
    await searchInput.typeText('xyznonexistent');

    await waitFor(element(by.text(/No objects found/)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should clear search and show empty state', async () => {
    const searchInput = element(by.label('Search celestial objects'));
    await searchInput.clearText();

    await expect(element(by.text('Search for celestial objects by name'))).toBeVisible();
  });
});
