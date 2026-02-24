import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
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

const TYPE_ICONS: Record<string, string> = {
  star: '\u2605',
  planet: '\u25CF',
  sun: '\u2609',
  moon: '\u263D',
  nebula: '\u2601',
  galaxy: '\u2736',
  cluster: '\u2022\u2022\u2022',
  planetary_nebula: '\u25CE',
};

function VisibilityBadge({ magnitude }: { magnitude: number }) {
  const { colors } = useTheme();
  const visible = magnitude <= 6.0;
  return (
    <View
      style={[styles.badge, { backgroundColor: visible ? colors.success : colors.textSecondary }]}
      accessibilityLabel={visible ? 'Visible to naked eye' : 'Requires telescope'}>
      <Text style={styles.badgeText}>{visible ? 'Naked eye' : `Mag ${magnitude.toFixed(1)}`}</Text>
    </View>
  );
}

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
      <View style={styles.resultIcon}>
        <Text style={[styles.iconText, { color: colors.accent }]}>{icon}</Text>
      </View>
      <View style={styles.resultContent}>
        <View style={styles.nameRow}>
          <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
            {item.commonName ?? item.name}
          </Text>
          {isLocked && (
            <View style={[styles.proBadge, { backgroundColor: colors.primary + '20' }]}>
              <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          )}
        </View>
        {item.commonName && (
          <Text style={[styles.resultCatalog, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.name}
          </Text>
        )}
        <Text style={[styles.resultType, { color: colors.textSecondary }]}>
          {item.type.charAt(0).toUpperCase() + item.type.slice(1).replace('_', ' ')}
        </Text>
      </View>
      <VisibilityBadge magnitude={item.magnitude} />
    </TouchableOpacity>
  );
}

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
        // Get brightest objects (mag ≤ 4.0 covers Sun, Moon, planets, bright stars)
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
          // Sort by altitude descending (highest first)
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

function VisibleNowSection({ onSelect }: { onSelect: (id: number) => void }) {
  const { colors } = useTheme();
  const { items, loading } = useVisibleNow();

  if (loading) {
    return (
      <View style={styles.visibleSection}>
        <Text style={[styles.visibleTitle, { color: colors.text }]}>Visible Now</Text>
        <ActivityIndicator size="small" color={colors.primary} style={styles.visibleLoader} />
      </View>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.visibleSection}>
      <Text style={[styles.visibleTitle, { color: colors.text }]}>Visible Now</Text>
      {items.map(({ obj, altitude, azimuth }) => {
        const icon = TYPE_ICONS[obj.type] ?? '\u2022';
        return (
          <TouchableOpacity
            key={obj.id}
            style={[
              styles.visibleItem,
              { backgroundColor: colors.cardBackground, borderColor: colors.border },
            ]}
            onPress={() => onSelect(obj.id)}
            activeOpacity={0.7}>
            <Text style={[styles.visibleIcon, { color: colors.accent }]}>{icon}</Text>
            <View style={styles.visibleInfo}>
              <Text style={[styles.visibleName, { color: colors.text }]} numberOfLines={1}>
                {obj.commonName ?? obj.name}
              </Text>
              <Text style={[styles.visibleDetail, { color: colors.textSecondary }]}>
                {azToCardinal(azimuth)} {'\u2022'} {altitude.toFixed(0)}
                {'\u00B0'} above horizon
              </Text>
            </View>
            <Text style={[styles.visibleAlt, { color: colors.success }]}>
              {altitude.toFixed(0)}
              {'\u00B0'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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
    // Auto-focus on mount
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
      <View
        style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.searchIcon, { color: colors.textSecondary }]}>{'\u{1F50D}'}</Text>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.text }]}
          placeholder="Search stars, planets, nebulae..."
          placeholderTextColor={colors.textSecondary}
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

      {!error && searchQuery.length === 0 && (
        <>
          <View style={styles.hintContainer}>
            <Text style={[styles.emptyIcon, { color: colors.textSecondary }]}>{'\u2605'}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Search for celestial objects by name
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              Try "Sirius", "Jupiter", or "M31"
            </Text>
          </View>
          <VisibleNowSection onSelect={handleSelect} />
        </>
      )}

      {!error && searchQuery.length > 0 && !loading && searchResults.length === 0 && (
        <View style={styles.stateContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  emptyHint: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  hintContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 32,
    paddingBottom: 8,
  },
  visibleSection: { paddingHorizontal: 16, paddingBottom: 8 },
  visibleLoader: { marginTop: 12 },
  visibleTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  visibleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  visibleIcon: { fontSize: 20, width: 32, textAlign: 'center' },
  visibleInfo: { flex: 1, marginLeft: 8 },
  visibleName: { fontSize: 15, fontWeight: '600' },
  visibleDetail: { fontSize: 12, marginTop: 2 },
  visibleAlt: { fontSize: 14, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  resultIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 22 },
  resultContent: { flex: 1, marginLeft: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  proBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  proBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  resultCatalog: { fontSize: 12, marginTop: 1 },
  resultType: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
});
