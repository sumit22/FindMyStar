import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  NativeModules,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useCatalogStore } from '../store/catalogStore';
import { useTrackingStore } from '../store/trackingStore';
import { usePreferencesStore } from '../store/preferencesStore';
import * as SensorFusion from '../services/SensorFusionService';
import * as ObjectTracker from '../services/ObjectTrackingService';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'AR'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Instrument color grading
const INST = {
  locked: '#3DDC84',
  close: '#3DDC84',
  medium: '#FFA726',
  far: 'rgba(74,158,255,0.7)',
  ring5: 'rgba(255,255,255,0.12)',
  ring1: 'rgba(255,255,255,0.18)',
  crosshair: 'rgba(255,255,255,0.35)',
};

const SPRING_TARGET = { stiffness: 150, damping: 24, mass: 1, useNativeDriver: false };
const DEADBAND_PX = 1.5; // Ignore sub-pixel jitter

function guideColor(distance: number): string {
  if (distance < 1) {
    return INST.locked;
  }
  if (distance < 10) {
    return INST.close;
  }
  if (distance < 30) {
    return INST.medium;
  }
  return INST.far;
}

function phaseLabel(
  ar: { angularDistance: number; isLocked: boolean } | null,
  relativeBearing: number,
  relativeElevation: number,
): string {
  if (!ar) {
    return '';
  }
  if (ar.isLocked) {
    return 'LOCKED';
  }
  const absBearing = Math.abs(relativeBearing);
  const absElev = Math.abs(relativeElevation);
  if (absBearing > absElev && absBearing > 5) {
    return relativeBearing > 0 ? 'TURN RIGHT' : 'TURN LEFT';
  }
  if (absElev > 5) {
    return relativeElevation > 0 ? 'TILT UP' : 'TILT DOWN';
  }
  return 'ALIGNING';
}

// ─── Phase Label (slow fade-pulse when not locked) ────────────
function PhaseLabel({ text, color, isLocked }: { text: string; color: string; isLocked: boolean }) {
  const pulse = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (isLocked) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLocked, pulse]);

  return (
    <Animated.Text style={[styles.phaseLabel, { color, opacity: pulse }]}>{text}</Animated.Text>
  );
}

// ─── Convergence Rings ─────────────────────────────────────────
// Faint 5° and 1° rings around screen center for spatial reference.
// Fade out when locked.
function ConvergenceRings({ degreesToPx, isLocked }: { degreesToPx: number; isLocked: boolean }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: isLocked ? 0 : 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [isLocked, fadeAnim]);

  const r5 = 5 * degreesToPx;
  const r1 = 1 * degreesToPx;

  return (
    <Animated.View style={[styles.ringsContainer, { opacity: fadeAnim }]} pointerEvents="none">
      <View
        style={[
          styles.convergenceRing,
          {
            width: r5 * 2,
            height: r5 * 2,
            borderRadius: r5,
            marginLeft: -r5,
            marginTop: -r5,
            borderColor: INST.ring5,
          },
        ]}
      />
      <View
        style={[
          styles.convergenceRing,
          {
            width: r1 * 2,
            height: r1 * 2,
            borderRadius: r1,
            marginLeft: -r1,
            marginTop: -r1,
            borderColor: INST.ring1,
          },
        ]}
      />
    </Animated.View>
  );
}

// ─── Crosshair (center reticle with breathing + lock pulse) ───
function Crosshair({ isLocked, distance }: { isLocked: boolean; distance: number }) {
  const breathe = useRef(new Animated.Value(1)).current;
  const wasLocked = useRef(false);

  useEffect(() => {
    if (isLocked && !wasLocked.current) {
      // Single lock pulse: scale up then settle
      wasLocked.current = true;
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.15,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(breathe, {
          toValue: 1,
          stiffness: 200,
          damping: 15,
          mass: 1,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!isLocked) {
      wasLocked.current = false;
    }
    // Idle: subtle breathing
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1.04,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isLocked, breathe]);

  const color = isLocked ? INST.locked : distance < 10 ? INST.close : INST.crosshair;

  return (
    <Animated.View
      style={[styles.crosshairContainer, { transform: [{ scale: breathe }] }]}
      pointerEvents="none">
      {/* Horizontal hair */}
      <View style={[styles.crosshairH, { backgroundColor: color }]} />
      {/* Vertical hair */}
      <View style={[styles.crosshairV, { backgroundColor: color }]} />
      {/* Center dot */}
      <View style={[styles.crosshairDot, { backgroundColor: color }]} />
    </Animated.View>
  );
}

// ─── Instrument Readout (replaces rounded badge) ──────────────
function InstrumentReadout({ distance, isLocked }: { distance: number; isLocked: boolean }) {
  const color = guideColor(distance);

  if (isLocked) {
    return (
      <View style={styles.readoutContainer} pointerEvents="none">
        <Text style={[styles.readoutLocked, { color: INST.locked }]}>LOCKED</Text>
      </View>
    );
  }

  return (
    <View style={styles.readoutContainer} pointerEvents="none">
      <Text style={[styles.readoutValue, { color }]}>
        {distance.toFixed(1)}
        {'\u00B0'}
      </Text>
      <View style={styles.readoutRule} />
    </View>
  );
}

// ─── Sky Guide ────────────────────────────────────────────────
function SkyGuide({
  relativeBearing,
  relativeElevation,
  deviceElevation,
  angularDistance,
  isLocked,
  degreesToPx,
}: {
  relativeBearing: number;
  relativeElevation: number;
  deviceElevation: number;
  angularDistance: number;
  isLocked: boolean;
  degreesToPx: number;
}) {
  const centerX = SCREEN_W / 2;
  const centerY = SCREEN_H / 2;
  const color = guideColor(angularDistance);

  // Spring-damped target position
  const animTX = useRef(new Animated.Value(centerX)).current;
  const animTY = useRef(new Animated.Value(centerY)).current;

  const halfFovDeg = SCREEN_W / (2 * degreesToPx);
  const bearingOffScreen = Math.abs(relativeBearing) > halfFovDeg;
  const elevOffScreen =
    relativeElevation > (SCREEN_H / 2 - 60) / degreesToPx ||
    relativeElevation < -(SCREEN_H / 2 - 120) / degreesToPx;

  const horizonY = centerY + deviceElevation * degreesToPx;
  const horizonVisible = horizonY > -20 && horizonY < SCREEN_H + 20;

  const targetX = centerX + relativeBearing * degreesToPx;
  const targetY = centerY - relativeElevation * degreesToPx;
  const clampedTX = Math.max(20, Math.min(SCREEN_W - 20, targetX));
  const clampedTY = Math.max(60, Math.min(SCREEN_H - 120, targetY));
  const targetOnScreen = Math.abs(targetX - clampedTX) < 2 && Math.abs(targetY - clampedTY) < 2;

  // Animate crosshair with critically damped spring + deadband to suppress jitter
  const prevTX = useRef(centerX);
  const prevTY = useRef(centerY);
  useEffect(() => {
    const dx = clampedTX - 8 - prevTX.current;
    const dy = clampedTY - 8 - prevTY.current;
    if (Math.abs(dx) < DEADBAND_PX && Math.abs(dy) < DEADBAND_PX) {
      return;
    }
    prevTX.current = clampedTX - 8;
    prevTY.current = clampedTY - 8;
    Animated.parallel([
      Animated.spring(animTX, { toValue: clampedTX - 8, ...SPRING_TARGET }),
      Animated.spring(animTY, { toValue: clampedTY - 8, ...SPRING_TARGET }),
    ]).start();
  }, [clampedTX, clampedTY, animTX, animTY, centerX, centerY]);

  const azMarkerX = clampedTX;

  // Glideslope column: shorter, max 12 dots, fading opacity
  const plumbStartY = Math.max(60, Math.min(SCREEN_H - 120, horizonY));
  const maxColumnH = SCREEN_H * 0.4;
  const rawHeight = plumbStartY - clampedTY;
  const effectiveHeight = Math.min(rawHeight, maxColumnH);
  const dotSpacing = 14;
  const dotCount = effectiveHeight > 0 ? Math.min(12, Math.floor(effectiveHeight / dotSpacing)) : 0;

  if (isLocked) {
    return null;
  }

  // Off-screen bearing: show turn instruction
  if (bearingOffScreen) {
    const turnDir = relativeBearing > 0 ? 'right' : 'left';
    const arrow = relativeBearing > 0 ? '\u276F' : '\u276E';
    return (
      <View style={styles.skyGuideContainer} pointerEvents="none">
        <View
          style={[
            styles.turnHint,
            relativeBearing > 0 ? styles.turnHintRight : styles.turnHintLeft,
          ]}>
          <Text style={[styles.turnArrow, { color }]}>{arrow}</Text>
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
      {horizonVisible && <View style={[styles.horizonLine, { top: horizonY }]} />}

      {/* Azimuth marker on horizon */}
      {horizonVisible && (
        <View
          style={[
            styles.azimuthMarker,
            { left: azMarkerX - 5, top: horizonY - 5, borderBottomColor: color },
          ]}
        />
      )}

      {/* Glideslope column: dots fade from target (bright) to horizon (dim) */}
      {dotCount > 0 &&
        Array.from({ length: dotCount }, (_, i) => {
          const frac = dotCount > 1 ? i / (dotCount - 1) : 1;
          // Top 2 dots get extra brightness for directionality
          const boost = i >= dotCount - 2 ? 0.15 : 0;
          return (
            <View
              key={i}
              style={[
                styles.plumbDot,
                {
                  left: azMarkerX - 2,
                  top: plumbStartY - (i + 1) * dotSpacing,
                  backgroundColor: color,
                  opacity: Math.min(0.12 + 0.48 * frac + boost, 0.75),
                },
              ]}
            />
          );
        })}

      {/* Spring-damped target crosshair */}
      <Animated.View style={[styles.targetCrossContainer, { left: animTX, top: animTY }]}>
        <View style={[styles.targetCrossH, { backgroundColor: color }]} />
        <View style={[styles.targetCrossV, { backgroundColor: color }]} />
      </Animated.View>

      {/* Tilt hint */}
      {!targetOnScreen && elevOffScreen && (
        <View
          style={[
            styles.tiltHint,
            relativeElevation > 0 ? styles.tiltHintTop : styles.tiltHintBottom,
          ]}>
          <Text style={[styles.turnArrow, { color }]}>
            {relativeElevation > 0 ? '\u2303' : '\u2304'}
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

// ─── Lock Banner ──────────────────────────────────────────────
function LockBanner() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[styles.lockBanner, { opacity: fadeAnim }]}
      accessibilityRole="alert"
      accessibilityLabel="Target locked">
      <Text style={styles.lockText}>LOCKED</Text>
    </Animated.View>
  );
}

// ─── Debug Overlay (toggleable, instrument-quiet) ─────────────
function DebugOverlay({
  ar,
}: {
  ar: { altitude: number; azimuth: number; angularDistance: number; isLocked: boolean } | null;
}) {
  const [visible, setVisible] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const timer = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(timer);
  }, [visible]);

  const toggle = useCallback(() => setVisible(v => !v), []);

  if (!visible) {
    return (
      <TouchableOpacity
        style={styles.debugToggle}
        onPress={toggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Show debug info">
        <View style={styles.debugToggleDot} />
      </TouchableOpacity>
    );
  }

  const q = SensorFusion.getOrientation();
  const dbg = ObjectTracker.getDebugInfo();
  const noSensor = q.w === 1 && q.x === 0 && q.y === 0 && q.z === 0;

  return (
    <TouchableOpacity
      style={styles.debugOverlay}
      onPress={toggle}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Hide debug info">
      <View style={styles.debugRow}>
        <Text style={styles.debugText}>
          f:{dbg.frameCount} loc:({dbg.cachedLat.toFixed(2)},{dbg.cachedLon.toFixed(2)})
        </Text>
      </View>
      <View style={styles.debugRow}>
        {noSensor ? (
          <Text style={[styles.debugText, styles.debugWarn]}>NO SENSOR</Text>
        ) : ar ? (
          <Text style={styles.debugText}>
            alt:{ar.altitude.toFixed(1)} az:{ar.azimuth.toFixed(1)} d:
            {ar.angularDistance.toFixed(1)}
            {'\u00B0'}
            {ar.isLocked ? ' \u2713' : ''}
          </Text>
        ) : (
          <Text style={[styles.debugText, styles.debugWarn]}>NO FRAMES</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── AR Screen ────────────────────────────────────────────────
export default function ARScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation();
  const { objectId } = route.params;

  const getObjectById = useCatalogStore(s => s.getObjectById);
  const startTracking = useTrackingStore(s => s.startTracking);
  const stopTracking = useTrackingStore(s => s.stopTracking);
  const ar = useTrackingStore(s => s.ar);
  const cameraFovDeg = usePreferencesStore(s => s.cameraFovDeg);
  const degreesToPx = SCREEN_W / cameraFovDeg;

  const [objectName, setObjectName] = useState('');
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    NativeModules.KeepAwake?.activate();
    return () => NativeModules.KeepAwake?.deactivate();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const obj = await getObjectById(objectId);
        if (cancelled || !obj) {
          return;
        }
        setObjectName(obj.commonName ?? obj.name);
        await startTracking(obj);
      } catch (e) {
        if (!cancelled) {
          setInitError(e instanceof Error ? e.message : 'Failed to initialize tracking');
        }
      }
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

  const relativeBearing = ar ? ((ar.azimuth - ar.deviceHeading + 540) % 360) - 180 : 0;
  const relativeElevation = ar ? ar.altitude - ar.deviceElevation : 0;
  const isLocked = ar?.isLocked ?? false;
  const distance = ar?.angularDistance ?? 999;
  const phase = phaseLabel(ar, relativeBearing, relativeElevation);

  if (initError) {
    return (
      <View style={styles.container}>
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>TRACKING UNAVAILABLE</Text>
          <Text style={styles.errorMessage}>{initError}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.errorButtonText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cameraPlaceholder}>
        <Text style={styles.cameraText}>Camera Preview</Text>
        {/* Subtle depth vignette behind reticle */}
        <View style={styles.depthGlow} pointerEvents="none" />
      </View>

      <View style={[styles.overlay, { backgroundColor: colors.arOverlay }]}>
        {/* Top bar: name + phase */}
        <View style={styles.topBar}>
          <Text style={styles.objectLabel}>{objectName}</Text>
          {phase !== '' && (
            <PhaseLabel text={phase} color={guideColor(distance)} isLocked={isLocked} />
          )}
        </View>

        {/* Sky guide */}
        {ar && (
          <SkyGuide
            relativeBearing={relativeBearing}
            relativeElevation={relativeElevation}
            deviceElevation={ar.deviceElevation}
            angularDistance={distance}
            isLocked={isLocked}
            degreesToPx={degreesToPx}
          />
        )}

        {/* Convergence rings (5° + 1°) */}
        <ConvergenceRings degreesToPx={degreesToPx} isLocked={isLocked} />

        {/* Center crosshair with breathing */}
        <Crosshair isLocked={isLocked} distance={distance} />

        {/* Instrument readout */}
        {ar && <InstrumentReadout distance={distance} isLocked={isLocked} />}

        {/* Lock banner */}
        {isLocked && <LockBanner />}

        {/* Back */}
        <TouchableOpacity
          style={styles.arBackButton}
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Text style={styles.arBackChevron}>{'\u2039'}</Text>
        </TouchableOpacity>

        {__DEV__ && <DebugOverlay ar={ar} />}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  cameraText: { color: '#222', fontSize: 14 },
  depthGlow: {
    position: 'absolute',
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    backgroundColor: 'rgba(0,20,32,0.35)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    alignItems: 'center',
  },
  objectLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  phaseLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    marginTop: 8,
  },

  // ── Convergence rings ──
  ringsContainer: {
    position: 'absolute',
    top: SCREEN_H / 2,
    left: SCREEN_W / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convergenceRing: {
    position: 'absolute',
    borderWidth: 1,
  },

  // ── Crosshair ──
  crosshairContainer: {
    position: 'absolute',
    top: SCREEN_H / 2 - 14,
    left: SCREEN_W / 2 - 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 22,
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  crosshairV: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    height: 22,
    opacity: 0.6,
  },
  crosshairDot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    opacity: 0.8,
  },

  // ── Instrument readout ──
  readoutContainer: {
    position: 'absolute',
    top: SCREEN_H / 2 + 28,
    alignSelf: 'center',
    alignItems: 'center',
  },
  readoutValue: {
    fontSize: 22,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
  },
  readoutRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  readoutLocked: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 4,
  },

  // ── Sky guide ──
  skyGuideContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  horizonLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  azimuthMarker: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  plumbDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  targetCrossContainer: {
    position: 'absolute',
    width: 16,
    height: 16,
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

  // ── Turn / tilt hints ──
  turnHint: {
    position: 'absolute',
    top: SCREEN_H / 2 - 50,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },
  turnHintRight: { right: 16 },
  turnHintLeft: { left: 16 },
  tiltHint: {
    position: 'absolute',
    alignSelf: 'center',
    left: SCREEN_W / 2 - 60,
    width: 120,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },
  tiltHintTop: { top: 60 },
  tiltHintBottom: { bottom: 130 },
  turnArrow: { fontSize: 28, fontWeight: '300' },
  turnText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },

  // ── Lock banner ──
  lockBanner: {
    position: 'absolute',
    top: SCREEN_H * 0.15,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: INST.locked,
    backgroundColor: 'rgba(61,220,132,0.12)',
  },
  lockText: {
    fontSize: 14,
    fontWeight: '700',
    color: INST.locked,
    letterSpacing: 4,
  },

  // ── Back button ──
  arBackButton: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(0,0,0,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arBackChevron: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.60)',
    fontWeight: '300',
    marginLeft: -1,
  },

  // ── Debug overlay ──
  debugToggle: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  debugOverlay: {
    position: 'absolute',
    top: 52,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  debugRow: { flexDirection: 'row' },
  debugText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'monospace',
  },
  debugWarn: { color: 'rgba(255,100,100,0.7)' },

  // ── Error overlay ──
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,14,20,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B6B',
    letterSpacing: 3,
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  errorButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
  },
});
