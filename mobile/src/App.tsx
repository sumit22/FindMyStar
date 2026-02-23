import React, { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { NavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { usePreferencesStore } from './store/preferencesStore';
import * as BackgroundTask from './services/BackgroundTask';
import RootNavigator from './navigation/RootNavigator';
import type { RootStackParamList } from './navigation/types';

/**
 * Parse a deep link or notification payload to extract an objectId.
 * Supports: findmystar://object/123, or notification data { objectId: 123 }
 */
function parseObjectId(url: string): number | null {
  const match = url.match(/object\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function AppContent(): React.JSX.Element {
  const { navTheme } = useTheme();
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Handle deep links (notification taps)
  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      const objectId = parseObjectId(event.url);
      if (objectId !== null && navigationRef.current) {
        navigationRef.current.navigate('ObjectInfo', { objectId });
      }
    }

    // Handle link that opened the app (cold start)
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    // Handle links while app is running (warm start)
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App(): React.JSX.Element {
  const loadPreferences = usePreferencesStore(s => s.loadPreferences);

  useEffect(() => {
    loadPreferences();
    BackgroundTask.initialize();
    return () => BackgroundTask.teardown();
  }, [loadPreferences]);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
