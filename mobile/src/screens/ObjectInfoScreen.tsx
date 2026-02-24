import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useCatalogStore } from '../store/catalogStore';
import { useTrackingStore } from '../store/trackingStore';
import { useEntitlementStore } from '../store/entitlementStore';
import * as VisibilityService from '../services/VisibilityService';
import * as LocationService from '../services/LocationService';
import type { CelestialObject } from '../data/CatalogRepository';
import type { RiseSetInfo } from '../services/VisibilityService';
import type { RootStackParamList } from '../navigation/types';
import PurchaseSheet from '../purchase/PurchaseSheet';

type Route = RouteProp<RootStackParamList, 'ObjectInfo'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatTime(ms: number | null): string {
  if (ms === null) {
    return '--:--';
  }
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDegrees(deg: number): string {
  return `${deg.toFixed(1)}\u00B0`;
}

export default function ObjectInfoScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { objectId } = route.params;

  const getObjectById = useCatalogStore(s => s.getObjectById);
  const createAlarm = useTrackingStore(s => s.createAlarm);
  const deleteAlarm = useTrackingStore(s => s.deleteAlarm);
  const loadAlarms = useTrackingStore(s => s.loadAlarms);
  const trackedObjects = useTrackingStore(s => s.trackedObjects);

  const isPro = useEntitlementStore(s => s.isPro);

  const existingAlarm = trackedObjects.find(t => t.objectId === objectId) ?? null;

  const [obj, setObj] = useState<CelestialObject | null>(null);
  const [riseSet, setRiseSet] = useState<RiseSetInfo | null>(null);
  const [altAz, setAltAz] = useState<{ altitude: number; azimuth: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alarmLoading, setAlarmLoading] = useState(false);
  const [showAlarmPicker, setShowAlarmPicker] = useState(false);
  const [showPurchaseSheet, setShowPurchaseSheet] = useState(false);

  useEffect(() => {
    loadAlarms();
  }, [loadAlarms]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const object = await getObjectById(objectId);
      if (cancelled || !object) {
        setLoading(false);
        return;
      }
      setObj(object);

      try {
        const loc = await LocationService.getCurrentLocation();
        const [rs, aa] = await Promise.all([
          VisibilityService.computeRiseSet(object, loc.lat, loc.lon),
          VisibilityService.getCurrentAltAz(object, loc.lat, loc.lon),
        ]);
        if (!cancelled) {
          setRiseSet(rs);
          setAltAz(aa);
        }
      } catch {
        // Position data unavailable
      }
      if (!cancelled) {
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [objectId, getObjectById]);

  // Refresh alt/az every second
  useEffect(() => {
    if (!obj) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const loc = LocationService.getLastKnown();
        if (loc) {
          const aa = await VisibilityService.getCurrentAltAz(obj, loc.lat, loc.lon);
          setAltAz(aa);
        }
      } catch {
        /* ignore */
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [obj]);

  const handleTrack = useCallback(() => {
    if (obj) {
      navigation.navigate('AR', { objectId: obj.id });
    }
  }, [navigation, obj]);

  const doCreateAlarm = useCallback(
    async (minutes: number) => {
      if (!obj) {
        return;
      }
      setShowAlarmPicker(false);
      setAlarmLoading(true);
      try {
        // MVP: only one alarm per object — replace existing
        if (existingAlarm) {
          await deleteAlarm(existingAlarm.id);
        }
        await createAlarm(obj.id, { notifyBeforeMinutes: minutes });
        Alert.alert(
          'Alert Set',
          `You'll be notified ${minutes} min before ${obj.commonName ?? obj.name} rises.`,
        );
      } catch (e) {
        Alert.alert('Failed to Set Alert', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setAlarmLoading(false);
      }
    },
    [createAlarm, deleteAlarm, existingAlarm, obj],
  );

  const handleRemoveAlarm = useCallback(async () => {
    if (!existingAlarm) {
      return;
    }
    setShowAlarmPicker(false);
    setAlarmLoading(true);
    try {
      await deleteAlarm(existingAlarm.id);
      Alert.alert('Alert Removed', 'The visibility alert has been removed.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to remove alert');
    } finally {
      setAlarmLoading(false);
    }
  }, [deleteAlarm, existingAlarm]);

  const handleSetAlarm = useCallback(() => {
    if (!obj || alarmLoading) {
      return;
    }
    setShowAlarmPicker(true);
  }, [obj, alarmLoading]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!obj) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Object not found</Text>
      </View>
    );
  }

  const isAboveHorizon = altAz ? altAz.altitude > 0 : false;
  const isLocked = obj.isPro && !isPro;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.objectName, { color: colors.text }]} accessibilityRole="header">
            {obj.commonName ?? obj.name}
          </Text>
          {isLocked && (
            <View style={[styles.proHeaderBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.proHeaderBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          )}
        </View>
        {obj.commonName && (
          <Text style={[styles.catalogName, { color: colors.textSecondary }]}>{obj.name}</Text>
        )}
        <View style={styles.headerRow}>
          <Text style={[styles.objectType, { color: colors.accent }]}>
            {obj.type.charAt(0).toUpperCase() + obj.type.slice(1).replace('_', ' ')}
          </Text>
          <Text style={[styles.magnitude, { color: colors.textSecondary }]}>
            Mag {obj.magnitude.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* Position Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}
        accessibilityLabel={`Current position: altitude ${altAz ? formatDegrees(altAz.altitude) : 'unknown'}, azimuth ${altAz ? formatDegrees(altAz.azimuth) : 'unknown'}, ${isAboveHorizon ? 'above horizon' : 'below horizon'}`}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Current Position</Text>
        <View style={styles.positionRow}>
          <View style={styles.positionCol}>
            <Text style={[styles.positionLabel, { color: colors.textSecondary }]}>Altitude</Text>
            <Text style={[styles.positionValue, { color: colors.text }]}>
              {altAz ? formatDegrees(altAz.altitude) : '--'}
            </Text>
          </View>
          <View style={styles.positionCol}>
            <Text style={[styles.positionLabel, { color: colors.textSecondary }]}>Azimuth</Text>
            <Text style={[styles.positionValue, { color: colors.text }]}>
              {altAz ? formatDegrees(altAz.azimuth) : '--'}
            </Text>
          </View>
          <View style={styles.positionCol}>
            <Text style={[styles.positionLabel, { color: colors.textSecondary }]}>Status</Text>
            <Text
              style={[
                styles.positionValue,
                { color: isAboveHorizon ? colors.success : colors.error },
              ]}>
              {isAboveHorizon ? 'Above horizon' : 'Below horizon'}
            </Text>
          </View>
        </View>
      </View>

      {/* Rise/Set Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Rise & Set</Text>
        {riseSet?.isCircumpolar && (
          <Text style={[styles.specialStatus, { color: colors.success }]}>
            Circumpolar - always above the horizon
          </Text>
        )}
        {riseSet?.isNeverVisible && (
          <Text style={[styles.specialStatus, { color: colors.error }]}>
            Never visible from your location
          </Text>
        )}
        {riseSet && !riseSet.isCircumpolar && !riseSet.isNeverVisible && (
          <View style={styles.riseSetRow}>
            <View style={styles.riseSetCol}>
              <Text style={[styles.riseSetLabel, { color: colors.textSecondary }]}>Rise</Text>
              <Text style={[styles.riseSetTime, { color: colors.text }]}>
                {formatTime(riseSet.riseTime)}
              </Text>
            </View>
            <View style={styles.riseSetCol}>
              <Text style={[styles.riseSetLabel, { color: colors.textSecondary }]}>Set</Text>
              <Text style={[styles.riseSetTime, { color: colors.text }]}>
                {formatTime(riseSet.setTime)}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons or Upgrade Banner */}
      {isLocked ? (
        <View
          style={[
            styles.upgradeBanner,
            { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' },
          ]}>
          <Text style={[styles.upgradeBannerTitle, { color: colors.primary }]}>Pro Feature</Text>
          <Text style={[styles.upgradeBannerText, { color: colors.textSecondary }]}>
            Track and set alerts for this object with FindMyStar Pro.
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowPurchaseSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Unlock with Pro">
            <Text style={[styles.buttonText, { color: colors.textInverse }]}>Unlock with Pro</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: isAboveHorizon ? colors.primary : colors.border },
              ]}
              onPress={handleTrack}
              disabled={!isAboveHorizon}
              accessibilityRole="button"
              accessibilityLabel={
                isAboveHorizon
                  ? 'Track this object in AR view'
                  : 'Cannot track: object is below the horizon'
              }>
              <Text
                style={[
                  styles.buttonText,
                  { color: isAboveHorizon ? colors.textInverse : colors.textSecondary },
                ]}>
                Track
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                { borderColor: colors.primary },
                alarmLoading && styles.disabledOpacity,
              ]}
              onPress={handleSetAlarm}
              disabled={alarmLoading}
              accessibilityRole="button"
              accessibilityLabel={
                existingAlarm ? 'Edit visibility alert' : 'Set visibility alert for this object'
              }>
              {alarmLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primary }]}>
                  {existingAlarm ? 'Edit Alert' : 'Set Alert'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {!isAboveHorizon && altAz && (
            <Text style={[styles.horizonHint, { color: colors.textSecondary }]}>
              Tracking is available when the object rises above the horizon.
              {riseSet?.riseTime != null && ` Next rise: ${formatTime(riseSet.riseTime)}`}
            </Text>
          )}
        </>
      )}

      {/* Description */}
      {obj.description && (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>About</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {obj.description}
          </Text>
        </View>
      )}
      {/* Alert Timing Picker Modal */}
      <Modal
        visible={showAlarmPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlarmPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAlarmPicker(false)}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}
            onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {existingAlarm ? 'Edit Alert' : 'Alert Before Rise'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              How early do you want to be notified?
            </Text>
            {[15, 30, 45, 60].map(min => {
              const isCurrent = existingAlarm?.notifyBeforeMinutes === min;
              return (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.modalOption,
                    { borderColor: colors.border },
                    isCurrent && { backgroundColor: colors.primary + '18' },
                  ]}
                  onPress={() => doCreateAlarm(min)}>
                  <Text style={[styles.modalOptionText, { color: colors.primary }]}>
                    {min} minutes{isCurrent ? '  (current)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {existingAlarm && (
              <TouchableOpacity
                style={[styles.modalOption, { borderColor: colors.border }]}
                onPress={handleRemoveAlarm}>
                <Text style={[styles.modalOptionText, { color: colors.error }]}>Remove Alert</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAlarmPicker(false)}>
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <PurchaseSheet
        visible={showPurchaseSheet}
        onClose={() => setShowPurchaseSheet(false)}
        onPurchaseComplete={() => {}}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16 },
  header: { padding: 20, paddingTop: 12 },
  objectName: { fontSize: 28, fontWeight: '700' },
  catalogName: { fontSize: 14, marginTop: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
  objectType: { fontSize: 14, fontWeight: '600' },
  magnitude: { fontSize: 14 },
  card: { margin: 16, marginBottom: 0, padding: 16, borderRadius: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  positionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  positionCol: { alignItems: 'center', flex: 1 },
  positionLabel: { fontSize: 12, marginBottom: 4 },
  positionValue: { fontSize: 16, fontWeight: '600' },
  specialStatus: { fontSize: 14, fontWeight: '500' },
  riseSetRow: { flexDirection: 'row', justifyContent: 'space-around' },
  riseSetCol: { alignItems: 'center' },
  riseSetLabel: { fontSize: 12, marginBottom: 4 },
  riseSetTime: { fontSize: 20, fontWeight: '600' },
  actions: { flexDirection: 'row', margin: 16, gap: 12 },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
  },
  disabledOpacity: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  horizonHint: { fontSize: 13, marginHorizontal: 16, marginTop: 4, textAlign: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proHeaderBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  proHeaderBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  upgradeBanner: {
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  upgradeBannerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  upgradeBannerText: { fontSize: 14, textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  upgradeButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    alignItems: 'center',
  },
  description: { fontSize: 14, lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, marginBottom: 16 },
  modalOption: {
    paddingVertical: 14,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  modalOptionText: { fontSize: 16, fontWeight: '600' },
  modalCancel: { paddingTop: 16, alignItems: 'center' },
  modalCancelText: { fontSize: 15 },
});
