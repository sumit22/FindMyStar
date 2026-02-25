import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  NativeModules,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useCatalogStore } from '../store/catalogStore';
import { useTrackingStore } from '../store/trackingStore';
import * as SensorFusion from '../services/SensorFusionService';
import * as ObjectTracker from '../services/ObjectTrackingService';
import type { AppColors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'AR'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DEGREES_TO_PX = SCREEN_W / 60; // ~60° FOV maps to screen width

function ViewportCenter({ distance, colors }: { distance: number; colors: AppColors }) {
  const color =
    distance < 1 ? colors.arLocked : distance < 10 ? colors.success : 'rgba(255,255,255,0.3)';
  return (
    <View style={styles.viewportCenter} pointerEvents="none">
      <View style={[styles.viewportRing, { borderColor: color }]} />
      <View style={[styles.viewportDot, { backgroundColor: color }]} />
    </View>
  );
}

function SkyGuide({
  relativeBearing,
  relativeElevation,
  deviceElevation,
  angularDistance,
  isLocked,
}: {
  relativeBearing: number;
  relativeElevation: number;
  deviceElevation: number;
  angularDistance: number;
  isLocked: boolean;
}) {
  const { colors } = useTheme();
  const centerX = SCREEN_W / 2;
  const centerY = SCREEN_H / 2;

  // Proximity color: blue → yellow → green → locked
  const guideColor =
    angularDistance < 1
      ? colors.arLocked
      : angularDistance < 10
        ? colors.success
        : angularDistance < 30
          ? colors.warning
          : colors.primary;

  // Half the visible FOV in degrees (~30° each side)
  const halfFovDeg = SCREEN_W / (2 * DEGREES_TO_PX);

  // Is target horizontally off-screen?
  const bearingOffScreen = Math.abs(relativeBearing) > halfFovDeg;
  // Is target vertically off-screen?
  const elevOffScreen =
    relativeElevation > (SCREEN_H / 2 - 60) / DEGREES_TO_PX ||
    relativeElevation < -(SCREEN_H / 2 - 120) / DEGREES_TO_PX;

  // Horizon Y: when phone tilts up, horizon drops below center
  const horizonY = centerY + deviceElevation * DEGREES_TO_PX;
  const horizonVisible = horizonY > -20 && horizonY < SCREEN_H + 20;

  // Target screen position
  const targetX = centerX + relativeBearing * DEGREES_TO_PX;
  const targetY = centerY - relativeElevation * DEGREES_TO_PX;

  // Clamp target marker to screen edges
  const clampedTX = Math.max(20, Math.min(SCREEN_W - 20, targetX));
  const clampedTY = Math.max(60, Math.min(SCREEN_H - 120, targetY));
  const targetOnScreen = Math.abs(targetX - clampedTX) < 2 && Math.abs(targetY - clampedTY) < 2;

  // Azimuth marker X on the horizon
  const azMarkerX = clampedTX;

  // Plumb line: dots from horizon up to target
  const plumbStartY = Math.max(60, Math.min(SCREEN_H - 120, horizonY));
  const plumbEndY = clampedTY;
  const plumbHeight = plumbStartY - plumbEndY;
  const dotSpacing = 12;
  const dotCount = plumbHeight > 0 ? Math.min(25, Math.floor(plumbHeight / dotSpacing)) : 0;

  if (isLocked) {
    return null;
  }

  // When target is far off-screen, show a large turn/tilt instruction instead of tiny clamped markers
  if (bearingOffScreen) {
    const turnDir = relativeBearing > 0 ? 'right' : 'left';
    const arrow = relativeBearing > 0 ? '\u25B6' : '\u25C0';
    return (
      <View style={styles.skyGuideContainer} pointerEvents="none">
        {/* Large arrow at screen edge pointing toward target */}
        <View
          style={[
            styles.turnHint,
            relativeBearing > 0 ? styles.turnHintRight : styles.turnHintLeft,
          ]}>
          <Text style={[styles.turnArrow, { color: guideColor }]}>{arrow}</Text>
          <Text style={styles.turnText}>
            Turn {turnDir} {Math.abs(relativeBearing).toFixed(0)}
            {'\u00B0'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.skyGuideContainer} pointerEvents="none">
      {/* Horizon line */}
      {horizonVisible && (
        <>
          <View style={[styles.horizonLine, { top: horizonY }]} />
          <Text style={[styles.horizonLabel, { top: horizonY - 10 }]}>{'— horizon —'}</Text>
        </>
      )}

      {/* Azimuth marker on horizon */}
      {horizonVisible && (
        <View
          style={[
            styles.azimuthMarker,
            { left: azMarkerX - 6, top: horizonY - 6, borderBottomColor: guideColor },
          ]}
        />
      )}

      {/* Plumb line (vertical dots from horizon to target) */}
      {dotCount > 0 &&
        Array.from({ length: dotCount }, (_, i) => (
          <View
            key={i}
            style={[
              styles.plumbDot,
              {
                left: azMarkerX - 2.5,
                top: plumbStartY - (i + 1) * dotSpacing,
                backgroundColor: guideColor,
              },
            ]}
          />
        ))}

      {/* Target crosshair */}
      <View style={[styles.targetCrossContainer, { left: clampedTX - 8, top: clampedTY - 8 }]}>
        <View style={[styles.targetCrossH, { backgroundColor: guideColor }]} />
        <View style={[styles.targetCrossV, { backgroundColor: guideColor }]} />
      </View>

      {/* Tilt hint when horizontally aligned but target is above/below screen */}
      {!targetOnScreen && elevOffScreen && (
        <View
          style={[
            styles.tiltHint,
            relativeElevation > 0 ? styles.tiltHintTop : styles.tiltHintBottom,
          ]}>
          <Text style={[styles.turnArrow, { color: guideColor }]}>
            {relativeElevation > 0 ? '\u25B2' : '\u25BC'}
          </Text>
          <Text style={styles.turnText}>
            Tilt {relativeElevation > 0 ? 'up' : 'down'} {Math.abs(relativeElevation).toFixed(0)}
            {'\u00B0'}
          </Text>
        </View>
      )}
    </View>
  );
}

function LockBanner() {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[styles.lockBanner, { backgroundColor: colors.arLocked, opacity: fadeAnim }]}
      accessibilityRole="alert"
      accessibilityLabel="Target locked">
      <Text style={styles.lockText}>TARGET LOCKED</Text>
    </Animated.View>
  );
}

function DebugOverlay({
  ar,
}: {
  ar: { altitude: number; azimuth: number; angularDistance: number; isLocked: boolean } | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(timer);
  }, []);

  const q = SensorFusion.getOrientation();
  const dbg = ObjectTracker.getDebugInfo();
  const isIdentity = q.w === 1 && q.x === 0 && q.y === 0 && q.z === 0;

  return (
    <View style={styles.debugOverlay}>
      <Text style={styles.debugText}>--- DEBUG ---</Text>
      <Text style={styles.debugText}>frames: {dbg.frameCount}</Text>
      <Text style={styles.debugText}>
        loc: ({dbg.cachedLat.toFixed(4)}, {dbg.cachedLon.toFixed(4)})
      </Text>
      <Text style={styles.debugText}>
        q: {q.w.toFixed(2)} {q.x.toFixed(2)} {q.y.toFixed(2)} {q.z.toFixed(2)}
      </Text>
      {isIdentity && <Text style={[styles.debugText, styles.debugTextError]}>NO SENSOR DATA</Text>}
      {ar ? (
        <>
          <Text style={styles.debugText}>
            alt={ar.altitude.toFixed(1)} az={ar.azimuth.toFixed(1)}
          </Text>
          <Text style={styles.debugText}>
            dist={ar.angularDistance.toFixed(1)}° lock={String(ar.isLocked)}
          </Text>
        </>
      ) : (
        <Text style={[styles.debugText, styles.debugTextError]}>NO FRAMES</Text>
      )}
    </View>
  );
}

export default function ARScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { objectId } = route.params;

  const getObjectById = useCatalogStore(s => s.getObjectById);
  const startTracking = useTrackingStore(s => s.startTracking);
  const stopTracking = useTrackingStore(s => s.stopTracking);
  const ar = useTrackingStore(s => s.ar);

  const [objectName, setObjectName] = useState('');

  // Keep screen awake while tracking
  useEffect(() => {
    NativeModules.KeepAwake?.activate();
    return () => NativeModules.KeepAwake?.deactivate();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const obj = await getObjectById(objectId);
      if (cancelled || !obj) {
        return;
      }
      setObjectName(obj.commonName ?? obj.name);
      await startTracking(obj);
    }
    init();
    return () => {
      cancelled = true;
      stopTracking();
    };
  }, [objectId, getObjectById, startTracking, stopTracking]);

  const handleBack = useCallback(() => {
    stopTracking();
    navigation.goBack();
  }, [navigation, stopTracking]);

  // Relative offsets: how far off in each axis
  const relativeBearing = ar
    ? ((ar.azimuth - ar.deviceHeading + 540) % 360) - 180 // normalize to [-180, 180]
    : 0;
  const relativeElevation = ar ? ar.altitude - ar.deviceElevation : 0;

  return (
    <View style={styles.container}>
      {/* Camera placeholder - actual camera requires react-native-camera */}
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraText}>Camera Preview</Text>
      </View>

      {/* AR Overlay */}
      <View style={[styles.overlay, { backgroundColor: colors.arOverlay }]}>
        <View style={styles.topBar}>
          <Text style={styles.objectLabel}>{objectName}</Text>
        </View>

        {/* Sky guide: horizon + plumb line + target crosshair */}
        {ar && (
          <SkyGuide
            relativeBearing={relativeBearing}
            relativeElevation={relativeElevation}
            deviceElevation={ar.deviceElevation}
            angularDistance={ar.angularDistance}
            isLocked={ar.isLocked}
          />
        )}

        {/* Viewport center marker — alignment target */}
        <ViewportCenter distance={ar?.angularDistance ?? 999} colors={colors} />

        {/* Distance badge below center */}
        {ar && (
          <View style={styles.arCenter}>
            <View
              style={[
                styles.distanceBadge,
                ar.angularDistance < 1
                  ? styles.badgeLocked
                  : ar.angularDistance < 10
                    ? styles.badgeClose
                    : styles.badgeFar,
              ]}>
              <Text style={styles.distanceText}>
                {ar.angularDistance.toFixed(1)}
                {'\u00B0'}
              </Text>
            </View>
          </View>
        )}

        {ar?.isLocked && <LockBanner />}

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Text style={styles.backButtonText}>{'\u2190'} Back</Text>
        </TouchableOpacity>

        {__DEV__ && <DebugOverlay ar={ar} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  cameraText: { color: '#333', fontSize: 16 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: { position: 'absolute', top: 60, alignSelf: 'center' },
  objectLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  arCenter: { alignItems: 'center', justifyContent: 'center' },
  viewportCenter: {
    position: 'absolute',
    top: SCREEN_H / 2 - 12,
    left: SCREEN_W / 2 - 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skyGuideContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  horizonLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  horizonLabel: {
    position: 'absolute',
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: 'rgba(255,255,255,0.25)',
    letterSpacing: 2,
  },
  azimuthMarker: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  plumbDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.7,
  },
  targetCrossH: {
    position: 'absolute',
    top: 7,
    left: 0,
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  targetCrossV: {
    position: 'absolute',
    top: 0,
    left: 7,
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  offScreenLabel: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '700',
  },
  turnHint: {
    position: 'absolute',
    top: SCREEN_H / 2 - 50,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  tiltHint: {
    position: 'absolute',
    alignSelf: 'center',
    left: SCREEN_W / 2 - 60,
    width: 120,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  turnArrow: {
    fontSize: 32,
    fontWeight: '700',
  },
  turnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  distanceBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  distanceText: { fontSize: 24, fontWeight: '700', color: '#fff' },
  lockBanner: {
    position: 'absolute',
    top: SCREEN_H * 0.15,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  lockText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: 2 },
  backButton: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  debugOverlay: {
    position: 'absolute',
    top: 100,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff8800',
    maxWidth: 280,
  },
  debugText: { fontSize: 10, color: '#ffcc00', fontFamily: 'monospace' },
  debugTextError: { color: '#ff4444' },
  viewportRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  viewportDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  targetCrossContainer: { position: 'absolute' },
  turnHintRight: { right: 16 },
  turnHintLeft: { left: 16 },
  tiltHintTop: { top: 60 },
  tiltHintBottom: { bottom: 130 },
  badgeLocked: { backgroundColor: 'rgba(76,175,80,0.7)' },
  badgeClose: { backgroundColor: 'rgba(102,187,106,0.7)' },
  badgeFar: { backgroundColor: 'rgba(0,0,0,0.6)' },
});
