import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useTrackingStore } from '../store/trackingStore';
import type { TrackedObjectInfo } from '../store/trackingStore';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatTime(ms: number | null): string {
  if (ms === null) return 'Calculating...';
  const d = new Date(ms);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

function AlarmItem({
  alarm,
  onPress,
  onToggle,
  onDelete,
}: {
  alarm: TrackedObjectInfo;
  onPress: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.alarmItem,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
        !alarm.enabled && styles.alarmDisabled,
      ]}
      onPress={onPress}
      onLongPress={onDelete}
      accessibilityRole="button"
      accessibilityLabel={`${alarm.objectName}, next rise ${formatTime(alarm.nextRiseMs)}`}
    >
      <View style={styles.alarmContent}>
        <Text
          style={[
            styles.alarmName,
            { color: alarm.enabled ? colors.text : colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          {alarm.objectName}
        </Text>
        <Text style={[styles.alarmTime, { color: colors.textSecondary }]}>
          {alarm.nextRiseMs
            ? `Next rise: ${formatTime(alarm.nextRiseMs)}`
            : 'Calculating next visibility...'}
        </Text>
        <Text style={[styles.alarmMeta, { color: colors.textSecondary }]}>
          Min alt: {alarm.minAltitude}{'\u00B0'} {'\u2022'} {alarm.notifyBeforeMinutes}min before
          {alarm.isRecurring ? ' \u2022 Recurring' : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.toggleBtn,
          { backgroundColor: alarm.enabled ? colors.primary : colors.border },
        ]}
        onPress={onToggle}
        accessibilityRole="switch"
        accessibilityLabel={alarm.enabled ? 'Disable alarm' : 'Enable alarm'}
        accessibilityState={{ checked: alarm.enabled }}
      >
        <View
          style={[
            styles.toggleThumb,
            alarm.enabled ? styles.toggleOn : styles.toggleOff,
          ]}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function AlarmsScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const trackedObjects = useTrackingStore(s => s.trackedObjects);
  const loading = useTrackingStore(s => s.loading);
  const loadAlarms = useTrackingStore(s => s.loadAlarms);
  const toggleAlarm = useTrackingStore(s => s.toggleAlarm);
  const deleteAlarm = useTrackingStore(s => s.deleteAlarm);
  const refreshAlarms = useTrackingStore(s => s.refreshAlarms);

  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  const handlePress = useCallback(
    (objectId: number) => {
      navigation.navigate('ObjectInfo', { objectId });
    },
    [navigation],
  );

  const handleDelete = useCallback(
    (alarm: TrackedObjectInfo) => {
      Alert.alert(
        'Delete Alarm',
        `Remove the alarm for ${alarm.objectName}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteAlarm(alarm.id),
          },
        ],
      );
    },
    [deleteAlarm],
  );

  const renderItem = useCallback(
    ({ item }: { item: TrackedObjectInfo }) => (
      <AlarmItem
        alarm={item}
        onPress={() => handlePress(item.objectId)}
        onToggle={() => toggleAlarm(item.id)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [handlePress, toggleAlarm, handleDelete],
  );

  const keyExtractor = useCallback((item: TrackedObjectInfo) => String(item.id), []);

  if (trackedObjects.length === 0 && !loading) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyIcon, { color: colors.textSecondary }]}>{'\u{1F514}'}</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No alarms set</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Search for an object and tap "Set Alert" to get notified when it becomes visible.
        </Text>
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('MainTabs')}
          accessibilityRole="button"
          accessibilityLabel="Go to search"
        >
          <Text style={[styles.searchButtonText, { color: colors.textInverse }]}>
            Search Objects
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={trackedObjects}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshAlarms}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  searchButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  searchButtonText: { fontSize: 16, fontWeight: '600' },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  alarmDisabled: { opacity: 0.5 },
  alarmContent: { flex: 1 },
  alarmName: { fontSize: 16, fontWeight: '600' },
  alarmTime: { fontSize: 14, marginTop: 4 },
  alarmMeta: { fontSize: 12, marginTop: 2 },
  toggleBtn: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginLeft: 12,
  },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleOn: { alignSelf: 'flex-end' },
  toggleOff: { alignSelf: 'flex-start' },
});
