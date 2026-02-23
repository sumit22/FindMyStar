import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useCatalogStore } from '../store/catalogStore';
import { useTrackingStore } from '../store/trackingStore';
import type { AppColors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';

type Route = RouteProp<RootStackParamList, 'AR'>;

const SCREEN_H = Dimensions.get('window').height;
const ARROW_SIZE = 64;

function getArrowColor(
  distance: number,
  colors: AppColors,
): string {
  if (distance < 1) {return colors.arLocked;}
  if (distance < 5) {return colors.warning;}
  return colors.error;
}

function ArrowIndicator({ angle, distance, locked }: { angle: number; distance: number; locked: boolean }) {
  const { colors } = useTheme();
  const rotateAnim = useRef(new Animated.Value(angle)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: angle,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [angle, rotateAnim]);

  useEffect(() => {
    if (locked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [locked, scaleAnim]);

  const color = getArrowColor(distance, colors);
  const interpolatedRotation = rotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.arrowContainer,
        {
          transform: [
            { rotate: interpolatedRotation },
            { scale: scaleAnim },
          ],
        },
      ]}
      accessibilityLabel={`Arrow pointing toward target, ${distance.toFixed(1)} degrees away`}
    >
      <View style={[styles.arrowHead, { borderBottomColor: color }]} />
      <View style={[styles.arrowShaft, { backgroundColor: color }]} />
    </Animated.View>
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
      accessibilityLabel="Target locked"
    >
      <Text style={styles.lockText}>TARGET LOCKED</Text>
    </Animated.View>
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

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const obj = await getObjectById(objectId);
      if (cancelled || !obj) {return;}
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

  const arrowAngle = ar
    ? Math.atan2(ar.azimuth, ar.altitude) * (180 / Math.PI)
    : 0;

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

        {ar && (
          <View style={styles.arCenter}>
            <ArrowIndicator
              angle={arrowAngle}
              distance={ar.angularDistance}
              locked={ar.isLocked}
            />
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>
                {ar.angularDistance.toFixed(1)}{'\u00B0'}
              </Text>
            </View>
          </View>
        )}

        {ar?.isLocked && <LockBanner />}

        {ar && (
          <View style={styles.infoBar}>
            <Text style={styles.infoText}>
              Alt: {ar.altitude.toFixed(1)}{'\u00B0'}  Az: {ar.azimuth.toFixed(1)}{'\u00B0'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButtonText}>{'\u2190'} Back</Text>
        </TouchableOpacity>
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
  arrowContainer: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE / 3,
    borderRightWidth: ARROW_SIZE / 3,
    borderBottomWidth: ARROW_SIZE / 2,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowShaft: { width: ARROW_SIZE / 5, height: ARROW_SIZE / 3, marginTop: -2 },
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
  infoBar: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  infoText: { fontSize: 14, color: '#fff' },
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
});
