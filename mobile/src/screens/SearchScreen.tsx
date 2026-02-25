import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  StyleProp,
  TextStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useCatalogStore } from '../store/catalogStore';
import { useEntitlementStore } from '../store/entitlementStore';
import * as CatalogRepo from '../data/CatalogRepository';
import type { CelestialObject } from '../data/CatalogRepository';
import * as VisibilityService from '../services/VisibilityService';
import * as LocationService from '../services/LocationService';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ── Instrument-grade type markers ── */
const TYPE_ICONS: Record<string, string> = {
  star: '\u2022', // •
  planet: '\u25CF', // ●
  sun: '\u2609', // ☉
  moon: '\u25D0', // ◐
  nebula: '\u2237', // ∷
  galaxy: '\u2735', // ✵
  cluster: '\u2234', // ∴
  planetary_nebula: '\u25CE', // ◎
};

/* ── Shared label for small-caps style ── */
function InstrumentLabel({
  text,
  color,
  style,
}: {
  text: string;
  color: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.instrumentLabel, { color }, style]}>{text}</Text>;
}

/* ── Result row ── */
function ResultItem({
  item,
  onPress,
  isLocked,
}: {
  item: CelestialObject;
  onPress: () => void;
  isLocked: boolean;
}) {
  const { colors } = useTheme();
  const icon = TYPE_ICONS[item.type] ?? '\u2022';
  const visible = item.magnitude <= 6.0;

  return (
    <TouchableOpacity
      style={[
        styles.resultItem,
        { backgroundColor: colors.cardBackground, borderColor: colors.border },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.commonName ?? item.name}, ${item.type}, magnitude ${item.magnitude.toFixed(1)}${isLocked ? ', Pro required' : ''}`}
      activeOpacity={0.7}>
      {/* Type marker */}
      <Text style={[styles.typeMarker, { color: colors.accent + '90' }]}>{icon}</Text>

      {/* Name + catalog */}
      <View style={styles.resultContent}>
        <View style={styles.nameRow}>
          <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
            {item.commonName ?? item.name}
          </Text>
          {isLocked && (
            <View style={[styles.proBadge, { backgroundColor: colors.primary + '18' }]}>
              <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={[styles.resultMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.commonName ? `${item.name}  \u2022  ` : ''}
          {item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('_', ' ')}
        </Text>
      </View>

      {/* Magnitude */}
      <View style={styles.magColumn}>
        <Text style={[styles.magValue, { color: visible ? colors.success : colors.textSecondary }]}>
          {item.magnitude.toFixed(1)}
        </Text>
        <Text style={[styles.magUnit, { color: colors.textSecondary }]}>mag</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Visible Now hook ── */
interface VisibleObject {
  obj: CelestialObject;
  altitude: number;
  azimuth: number;
}

function useVisibleNow(): { items: VisibleObject[]; loading: boolean } {
  const [items, setItems] = useState<VisibleObject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const loc = await LocationService.getCurrentLocation();
        const all = await CatalogRepo.getAllObjects();
        const bright = all.filter(o => o.magnitude <= 4.0).slice(0, 30);

        const visible: VisibleObject[] = [];
        for (const obj of bright) {
          if (cancelled) {
            return;
          }
          try {
            const aa = await VisibilityService.getCurrentAltAz(obj, loc.lat, loc.lon);
            if (aa.altitude > 0) {
              visible.push({ obj, altitude: aa.altitude, azimuth: aa.azimuth });
            }
          } catch {
            // skip object on error
          }
        }

        if (!cancelled) {
          visible.sort((a, b) => b.altitude - a.altitude);
          setItems(visible.slice(0, 5));
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, loading };
}

function azToCardinal(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}

/* ── Visible Now section ── */
function VisibleNowSection({ onSelect }: { onSelect: (id: number) => void }) {
  const { colors } = useTheme();
  const { items, loading } = useVisibleNow();

  if (loading) {
    return (
      <View style={styles.visibleSection}>
        <InstrumentLabel text="VISIBLE NOW" color={colors.textSecondary} />
        <ActivityIndicator size="small" color={colors.primary} style={styles.visibleLoader} />
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.visibleSection}>
      <InstrumentLabel text="VISIBLE NOW" color={colors.textSecondary} />
      <View style={[styles.visibleList, { borderColor: colors.border }]}>
        {items.map(({ obj, altitude, azimuth }, idx) => {
          const icon = TYPE_ICONS[obj.type] ?? '\u2022';
          return (
            <React.Fragment key={obj.id}>
              {idx > 0 && <View style={[styles.hairline, { backgroundColor: colors.border }]} />}
              <TouchableOpacity
                style={styles.visibleRow}
                onPress={() => onSelect(obj.id)}
                activeOpacity={0.6}>
                <Text style={[styles.visibleMarker, { color: colors.accent + '80' }]}>{icon}</Text>
                <View style={styles.visibleInfo}>
                  <Text style={[styles.visibleName, { color: colors.text }]} numberOfLines={1}>
                    {obj.commonName ?? obj.name}
                  </Text>
                  <Text style={[styles.visibleDir, { color: colors.textSecondary }]}>
                    {azToCardinal(azimuth)}
                  </Text>
                </View>
                <Text style={[styles.visibleAlt, { color: colors.success }]}>
                  {altitude.toFixed(0)}
                  {'\u00B0'}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

/* ── Main search screen ── */
export default function SearchScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const inputRef = useRef<TextInput>(null);

  const searchQuery = useCatalogStore(s => s.searchQuery);
  const searchResults = useCatalogStore(s => s.searchResults);
  const loading = useCatalogStore(s => s.loading);
  const error = useCatalogStore(s => s.error);
  const searchObjects = useCatalogStore(s => s.searchObjects);
  const isPro = useEntitlementStore(s => s.isPro);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSelect = useCallback(
    (objectId: number) => {
      navigation.navigate('ObjectInfo', { objectId });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: CelestialObject }) => (
      <ResultItem
        item={item}
        onPress={() => handleSelect(item.id)}
        isLocked={item.isPro && !isPro}
      />
    ),
    [handleSelect, isPro],
  );

  const keyExtractor = useCallback((item: CelestialObject) => String(item.id), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}>
        <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>{'\u2315'}</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          placeholder="Search objects..."
          placeholderTextColor={colors.textSecondary + '80'}
          value={searchQuery}
          onChangeText={searchObjects}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search celestial objects"
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      {error && (
        <View style={styles.stateContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      {/* Empty state — no hero, just a subtle prompt */}
      {!error && searchQuery.length === 0 && (
        <>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Try "Sirius", "Jupiter", or "M31"
          </Text>
          <VisibleNowSection onSelect={handleSelect} />
        </>
      )}

      {!error && searchQuery.length > 0 && !loading && searchResults.length === 0 && (
        <View style={styles.stateContainer}>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            No objects found for "{searchQuery}"
          </Text>
        </View>
      )}

      <FlatList
        data={searchResults}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ── Search bar ── */
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
  },
  searchIcon: { fontSize: 16, marginRight: 6, opacity: 0.6 },
  input: { flex: 1, fontSize: 15, paddingVertical: 6 },

  /* ── States ── */
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: { fontSize: 13, textAlign: 'center' },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
    marginBottom: 6,
    letterSpacing: 0.2,
  },

  /* ── Instrument label ── */
  instrumentLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  /* ── Visible Now ── */
  visibleSection: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 6 },
  visibleLoader: { marginTop: 10 },
  visibleList: {
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  visibleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  hairline: { height: StyleSheet.hairlineWidth },
  visibleMarker: { fontSize: 14, width: 22, textAlign: 'center' },
  visibleInfo: { flex: 1, flexDirection: 'row', alignItems: 'baseline', marginLeft: 6 },
  visibleName: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  visibleDir: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginLeft: 8,
  },
  visibleAlt: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
    textAlign: 'right',
  },

  /* ── Result items ── */
  listContent: { paddingHorizontal: 14, paddingBottom: 20, paddingTop: 4 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeMarker: { fontSize: 14, width: 22, textAlign: 'center' },
  resultContent: { flex: 1, marginLeft: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultName: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  proBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  proBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  resultMeta: { fontSize: 11, marginTop: 2, letterSpacing: 0.2 },
  magColumn: { alignItems: 'flex-end', marginLeft: 8 },
  magValue: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  magUnit: { fontSize: 9, letterSpacing: 0.5, marginTop: 1 },
});
