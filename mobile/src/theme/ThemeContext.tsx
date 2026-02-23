import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { darkColors, lightColors, type AppColors } from './colors';
import { usePreferencesStore } from '../store/preferencesStore';

interface ThemeContextValue {
  isDark: boolean;
  colors: AppColors;
  navTheme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: true,
  colors: darkColors,
  navTheme: DarkTheme,
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const systemScheme = useColorScheme();
  const userPref = usePreferencesStore(s => s.theme);

  const isDark = userPref === 'system' ? systemScheme === 'dark' : userPref === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const navTheme: Theme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme : DefaultTheme).colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [isDark, colors],
  );

  const value = useMemo(() => ({ isDark, colors, navTheme }), [isDark, colors, navTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
