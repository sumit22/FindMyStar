import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useCatalogStore } from '../store/catalogStore';
import { useTrackingStore } from '../store/trackingStore';
import * as VisibilityService from '../services/VisibilityService';
import * as LocationService from '../services/LocationService';
import type { CelestialObject } from '../data/CatalogRepository';
import type { RiseSetInfo } from '../services/VisibilityService';
import type { RootStackParamList } from '../navigation/types';

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

  const [obj, setObj] = useState<CelestialObject | null>(null);
  const [riseSet, setRiseSet] = useState<RiseSetInfo | null>(null);
  const [altAz, setAltAz] = useState<{ altitude: number; azimuth: number } | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSetAlarm = useCallback(async () => {
    if (obj) {
      await createAlarm(obj.id);
    }
  }, [createAlarm, obj]);

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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.objectName, { color: colors.text }]} accessibilityRole="header">
          {obj.commonName ?? obj.name}
        </Text>
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

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleTrack}
          accessibilityRole="button"
          accessibilityLabel="Track this object in AR view">
          <Text style={[styles.buttonText, { color: colors.textInverse }]}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={handleSetAlarm}
          accessibilityRole="button"
          accessibilityLabel="Set visibility alert for this object">
          <Text style={[styles.buttonText, { color: colors.primary }]}>Set Alert</Text>
        </TouchableOpacity>
      </View>

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
  buttonText: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20 },
});
