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

/* ── Small-caps instrument label ── */
function Label({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.label, { color }]}>{text}</Text>;
}

/* ── Thin rule separator ── */
function Rule({ color }: { color: string }) {
  return <View style={[styles.rule, { backgroundColor: color }]} />;
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
        // Location or computation error — leave fields at defaults
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

  /* ── Loading ── */
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /* ── Not found ── */
  if (!obj) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Object not found</Text>
      </View>
    );
  }

  const isAboveHorizon = altAz ? altAz.altitude > 0 : false;
  const isLocked = obj.isPro && !isPro;
  const typeName = obj.type.charAt(0).toUpperCase() + obj.type.slice(1).replace('_', ' ');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      {/* ── Header: name + inline metadata ── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.objectName, { color: colors.text }]} accessibilityRole="header">
            {obj.commonName ?? obj.name}
          </Text>
          {isLocked && (
            <View style={[styles.proBadge, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          )}
        </View>
        {obj.commonName && (
          <Text style={[styles.catalogName, { color: colors.textSecondary }]}>{obj.name}</Text>
        )}
        {/* Structured TYPE / MAG row */}
        <View style={styles.metaRow}>
          <Label text="TYPE" color={colors.textSecondary} />
          <Text style={[styles.metaValue, { color: colors.accent }]}>{typeName}</Text>
          <View style={[styles.metaDot, { backgroundColor: colors.border }]} />
          <Label text="MAG" color={colors.textSecondary} />
          <Text style={[styles.metaValue, styles.tabular, { color: colors.text }]}>
            {obj.magnitude.toFixed(1)}
          </Text>
        </View>
      </View>

      <Rule color={colors.border} />

      {/* ── Position panel ── */}
      <View style={styles.panel}>
        <Label text="CURRENT POSITION" color={colors.textSecondary} />
        <View
          style={styles.positionGrid}
          accessibilityLabel={`Altitude ${altAz ? formatDegrees(altAz.altitude) : 'unknown'}, Azimuth ${altAz ? formatDegrees(altAz.azimuth) : 'unknown'}, ${isAboveHorizon ? 'above horizon' : 'below horizon'}`}>
          <View style={styles.positionCell}>
            <Text style={[styles.positionSmall, { color: colors.textSecondary }]}>ALT</Text>
            <Text style={[styles.positionNum, { color: colors.text }]}>
              {altAz ? formatDegrees(altAz.altitude) : '--'}
            </Text>
          </View>
          <View style={styles.positionCell}>
            <Text style={[styles.positionSmall, { color: colors.textSecondary }]}>AZ</Text>
            <Text style={[styles.positionNum, { color: colors.text }]}>
              {altAz ? formatDegrees(altAz.azimuth) : '--'}
            </Text>
          </View>
          <View style={styles.positionCell}>
            <Text style={[styles.positionSmall, { color: colors.textSecondary }]}>STATUS</Text>
            <Text
              style={[
                styles.positionStatus,
                { color: isAboveHorizon ? colors.success : colors.error },
              ]}>
              {isAboveHorizon ? 'VISIBLE' : 'BELOW'}
            </Text>
          </View>
        </View>
      </View>

      <Rule color={colors.border} />

      {/* ── Rise / Set panel ── */}
      <View style={styles.panel}>
        <Label text="RISE & SET" color={colors.textSecondary} />
        {riseSet?.isCircumpolar && (
          <Text style={[styles.specialNote, { color: colors.success }]}>
            Circumpolar — always visible
          </Text>
        )}
        {riseSet?.isNeverVisible && (
          <Text style={[styles.specialNote, { color: colors.error }]}>
            Never visible from your location
          </Text>
        )}
        {riseSet && !riseSet.isCircumpolar && !riseSet.isNeverVisible && (
          <View style={styles.riseSetGrid}>
            <View style={styles.riseSetCell}>
              <Text style={[styles.positionSmall, { color: colors.textSecondary }]}>RISE</Text>
              <Text style={[styles.riseSetTime, { color: colors.text }]}>
                {formatTime(riseSet.riseTime)}
              </Text>
            </View>
            <View style={styles.riseSetCell}>
              <Text style={[styles.positionSmall, { color: colors.textSecondary }]}>SET</Text>
              <Text style={[styles.riseSetTime, { color: colors.text }]}>
                {formatTime(riseSet.setTime)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <Rule color={colors.border} />

      {/* ── Actions or upgrade ── */}
      {isLocked ? (
        <View style={styles.upgradePanel}>
          <Label text="PRO FEATURE" color={colors.primary} />
          <Text style={[styles.upgradeText, { color: colors.textSecondary }]}>
            Track and set alerts for this object with FindMyStar Pro.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowPurchaseSheet(true)}
            accessibilityRole="button"
            accessibilityLabel="Unlock with Pro">
            <Text style={[styles.actionBtnText, { color: colors.textInverse }]}>UNLOCK PRO</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
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
                  styles.actionBtnText,
                  { color: isAboveHorizon ? colors.textInverse : colors.textSecondary },
                ]}>
                TRACK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.actionBtnOutline,
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
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  {existingAlarm ? 'EDIT ALERT' : 'SET ALERT'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {!isAboveHorizon && altAz && (
            <Text style={[styles.horizonHint, { color: colors.textSecondary }]}>
              Available when above horizon.
              {riseSet?.riseTime != null && ` Rise: ${formatTime(riseSet.riseTime)}`}
            </Text>
          )}
        </>
      )}

      {/* ── About ── */}
      {obj.description && (
        <>
          <Rule color={colors.border} />
          <View style={styles.panel}>
            <Label text="ABOUT" color={colors.textSecondary} />
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {obj.description}
            </Text>
          </View>
        </>
      )}

      {/* ── Alarm picker modal ── */}
      <Modal
        visible={showAlarmPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAlarmPicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAlarmPicker(false)}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}>
            <Label
              text={existingAlarm ? 'EDIT ALERT' : 'ALERT BEFORE RISE'}
              color={colors.textSecondary}
            />
            {[15, 30, 45, 60].map(min => {
              const isCurrent = existingAlarm?.notifyBeforeMinutes === min;
              return (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.modalOption,
                    { borderColor: colors.border },
                    isCurrent && { backgroundColor: colors.primary + '10' },
                  ]}
                  onPress={() => doCreateAlarm(min)}>
                  <Text style={[styles.modalOptionValue, { color: colors.primary }]}>{min}</Text>
                  <Text style={[styles.modalOptionUnit, { color: colors.textSecondary }]}>
                    min{isCurrent ? '  \u2713' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {existingAlarm && (
              <TouchableOpacity
                style={[styles.modalOption, { borderColor: colors.border }]}
                onPress={handleRemoveAlarm}>
                <Text style={[styles.modalOptionUnit, { color: colors.error }]}>REMOVE</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAlarmPicker(false)}>
              <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>CANCEL</Text>
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
  content: { paddingBottom: 28 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 14 },

  /* ── Header ── */
  header: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  objectName: { fontSize: 22, fontWeight: '300' },
  catalogName: { fontSize: 12, marginTop: 2, letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  metaValue: { fontSize: 13, fontWeight: '500' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 4 },
  tabular: { fontVariant: ['tabular-nums'] },
  proBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  proBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },

  /* ── Labels & rules ── */
  label: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 8 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 14 },

  /* ── Panels ── */
  panel: { paddingHorizontal: 14, paddingVertical: 14 },

  /* ── Position grid ── */
  positionGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  positionCell: { alignItems: 'center', flex: 1 },
  positionSmall: { fontSize: 9, fontWeight: '600', letterSpacing: 1.2, marginBottom: 4 },
  positionNum: {
    fontSize: 18,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  positionStatus: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },

  /* ── Rise/Set ── */
  specialNote: { fontSize: 13, fontWeight: '500' },
  riseSetGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  riseSetCell: { alignItems: 'center' },
  riseSetTime: {
    fontSize: 18,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },

  /* ── Actions ── */
  actionsRow: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.8 },
  disabledOpacity: { opacity: 0.5 },
  horizonHint: {
    fontSize: 12,
    marginHorizontal: 14,
    marginTop: 2,
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  /* ── Upgrade ── */
  upgradePanel: { paddingHorizontal: 14, paddingVertical: 14, alignItems: 'center' },
  upgradeText: { fontSize: 13, textAlign: 'center', marginBottom: 14, lineHeight: 18 },

  /* ── About ── */
  description: { fontSize: 13, lineHeight: 18 },

  /* ── Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '72%',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalOptionValue: {
    fontSize: 18,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  modalOptionUnit: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  modalCancel: { paddingTop: 14, alignItems: 'center' },
  modalCancelText: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
});
