import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePreferencesStore } from '../store/preferencesStore';
import type { ThemePref } from '../store/preferencesStore';
import * as Core from '../native/FindMyStarCore';
import { usePurchase } from '../purchase/usePurchase';

const DevSettingsPanel = __DEV__ ? require('../__dev__/DevSettingsPanel').default : null;

const THEME_OPTIONS: { label: string; value: ThemePref }[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
];

const ALTITUDE_OPTIONS = [5, 10, 15, 20, 30];

function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>;
}

function OptionRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.optionRow,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}>
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      {selected && <Text style={[styles.checkmark, { color: colors.primary }]}>{'\u2713'}</Text>}
    </TouchableOpacity>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.optionRow,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}>
      <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
      <View style={[styles.toggle, { backgroundColor: value ? colors.primary : colors.border }]}>
        <View style={[styles.toggleThumb, value ? styles.toggleOn : styles.toggleOff]} />
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen(): React.JSX.Element {
  const { colors } = useTheme();

  const theme = usePreferencesStore(s => s.theme);
  const notificationsEnabled = usePreferencesStore(s => s.notificationsEnabled);
  const minAltitudeDefault = usePreferencesStore(s => s.minAltitudeDefault);
  const setTheme = usePreferencesStore(s => s.setTheme);
  const setNotificationsEnabled = usePreferencesStore(s => s.setNotificationsEnabled);
  const setMinAltitudeDefault = usePreferencesStore(s => s.setMinAltitudeDefault);

  const [coreVersion, setCoreVersion] = React.useState('...');
  React.useEffect(() => {
    Core.coreVersion()
      .then(setCoreVersion)
      .catch(() => setCoreVersion('unavailable'));
  }, []);

  const { restore, loading: restoreLoading } = usePurchase();

  const handleToggleNotifications = useCallback(() => {
    setNotificationsEnabled(!notificationsEnabled);
  }, [notificationsEnabled, setNotificationsEnabled]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <SectionHeader title="APPEARANCE" />
      {THEME_OPTIONS.map(opt => (
        <OptionRow
          key={opt.value}
          label={opt.label}
          selected={theme === opt.value}
          onPress={() => setTheme(opt.value)}
        />
      ))}

      <SectionHeader title="NOTIFICATIONS" />
      <ToggleRow
        label="Enable notifications"
        value={notificationsEnabled}
        onToggle={handleToggleNotifications}
      />

      <SectionHeader title="MINIMUM ALTITUDE" />
      {ALTITUDE_OPTIONS.map(alt => (
        <OptionRow
          key={alt}
          label={`${alt}\u00B0`}
          selected={minAltitudeDefault === alt}
          onPress={() => setMinAltitudeDefault(alt)}
        />
      ))}

      <SectionHeader title="PURCHASES" />
      <TouchableOpacity
        style={[
          styles.optionRow,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}
        onPress={restore}
        disabled={restoreLoading}
        accessibilityRole="button"
        accessibilityLabel="Restore previous purchases">
        {restoreLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.optionLabel, { color: colors.primary }]}>Restore Purchases</Text>
        )}
      </TouchableOpacity>

      <SectionHeader title="ABOUT" />
      <View
        style={[
          styles.aboutCard,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}>
        <Text style={[styles.aboutTitle, { color: colors.text }]}>FindMyStar</Text>
        <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>Version 0.1.0</Text>
        <Text style={[styles.aboutVersion, { color: colors.textSecondary }]}>
          Core engine: {coreVersion}
        </Text>
        <Text style={[styles.aboutDescription, { color: colors.textSecondary }]}>
          Offline celestial object finder with AR guidance. All computations run locally on your
          device. No data is collected or transmitted.
        </Text>
      </View>

      {__DEV__ && DevSettingsPanel && <DevSettingsPanel />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 1,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
  },
  optionLabel: { fontSize: 16 },
  checkmark: { fontSize: 18, fontWeight: '700' },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleOn: { alignSelf: 'flex-end' },
  toggleOff: { alignSelf: 'flex-start' },
  aboutCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  aboutTitle: { fontSize: 20, fontWeight: '700' },
  aboutVersion: { fontSize: 14, marginTop: 4 },
  aboutDescription: { fontSize: 13, marginTop: 12, lineHeight: 19 },
});
