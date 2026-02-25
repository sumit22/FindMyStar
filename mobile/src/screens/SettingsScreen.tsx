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

// DevSettingsPanel is only available in development builds.
// The double-guard (__DEV__ + process.env.NODE_ENV) ensures dead-code
// elimination removes the entire require() in production bundles even if
// the Metro --dev flag is accidentally left on.
const DevSettingsPanel =
  __DEV__ && process.env.NODE_ENV !== 'production'
    ? require('../__dev__/DevSettingsPanel').default
    : null;

const THEME_OPTIONS: { label: string; value: ThemePref }[] = [
  { label: 'Dark', value: 'dark' },
  { label: 'Light', value: 'light' },
  { label: 'System', value: 'system' },
];

const ALTITUDE_OPTIONS = [5, 10, 15, 20, 30];

const FOV_OPTIONS = [
  { label: 'Narrow (40\u00B0)', value: 40 },
  { label: 'Standard (60\u00B0)', value: 60 },
  { label: 'Wide (75\u00B0)', value: 75 },
  { label: 'Ultra-wide (90\u00B0)', value: 90 },
];

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
  const cameraFovDeg = usePreferencesStore(s => s.cameraFovDeg);
  const setTheme = usePreferencesStore(s => s.setTheme);
  const setNotificationsEnabled = usePreferencesStore(s => s.setNotificationsEnabled);
  const setMinAltitudeDefault = usePreferencesStore(s => s.setMinAltitudeDefault);
  const setCameraFovDeg = usePreferencesStore(s => s.setCameraFovDeg);

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

      <SectionHeader title="CAMERA FOV" />
      {FOV_OPTIONS.map(opt => (
        <OptionRow
          key={opt.value}
          label={opt.label}
          selected={cameraFovDeg === opt.value}
          onPress={() => setCameraFovDeg(opt.value)}
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
  content: { paddingBottom: 28 },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginTop: 20,
    marginBottom: 6,
    marginHorizontal: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginHorizontal: 14,
    marginBottom: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginTop: 3,
  },
  optionLabel: { fontSize: 14 },
  checkmark: { fontSize: 16, fontWeight: '700' },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleOn: { alignSelf: 'flex-end' },
  toggleOff: { alignSelf: 'flex-start' },
  aboutCard: {
    marginHorizontal: 14,
    marginTop: 6,
    padding: 14,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  aboutTitle: { fontSize: 16, fontWeight: '600' },
  aboutVersion: { fontSize: 12, marginTop: 3, fontVariant: ['tabular-nums'] },
  aboutDescription: { fontSize: 12, marginTop: 10, lineHeight: 17, letterSpacing: 0.2 },
});
