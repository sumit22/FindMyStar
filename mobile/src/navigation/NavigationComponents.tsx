import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';

/* ── Custom back button for stack headers ── */
export function InstrumentBackButton({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const navigation = useNavigation();
  return (
    <TouchableOpacity
      style={styles.backBtn}
      onPress={onPress ?? (() => navigation.goBack())}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Go back">
      <Text style={[styles.backChevron, { color: colors.textSecondary }]}>{'\u2039'}</Text>
      <Text style={[styles.backLabel, { color: colors.textSecondary }]}>BACK</Text>
    </TouchableOpacity>
  );
}

/* ── Custom header title with letterSpacing ── */
export function InstrumentHeaderTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.headerTitle, { color: colors.text }]}>{children.toUpperCase()}</Text>;
}

/* ── Unicode-based tab bar icon ── */
export function TabIcon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={[styles.tabIcon, { color }]}>{glyph}</Text>;
}

/* ── Stable render callbacks for navigator options ── */
export function renderHeaderBack({ canGoBack }: { canGoBack?: boolean }) {
  return canGoBack ? <InstrumentBackButton /> : null;
}

export function renderHeaderTitle({ children }: { children: string }) {
  return <InstrumentHeaderTitle>{children}</InstrumentHeaderTitle>;
}

export function renderSearchTabIcon({ color }: { color: string }) {
  return <TabIcon glyph={'\u2315'} color={color} />;
}

export function renderAlarmsTabIcon({ color }: { color: string }) {
  return <TabIcon glyph={'\u25CE'} color={color} />;
}

const styles = StyleSheet.create({
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 12,
  },
  backChevron: { fontSize: 20, fontWeight: '300', marginRight: 4 },
  backLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5 },
  headerTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  tabIcon: { fontSize: 18, fontWeight: '300' },
});
