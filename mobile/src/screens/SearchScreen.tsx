import React, { useCallback, useEffect, useRef } from 'react';
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
import type { CelestialObject } from '../data/CatalogRepository';
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

function ResultItem({ item, onPress }: { item: CelestialObject; onPress: () => void }) {
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
      accessibilityLabel={`${item.commonName ?? item.name}, ${item.type}, magnitude ${item.magnitude.toFixed(1)}`}
      activeOpacity={0.7}>
      <View style={styles.resultIcon}>
        <Text style={[styles.iconText, { color: colors.accent }]}>{icon}</Text>
      </View>
      <View style={styles.resultContent}>
        <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
          {item.commonName ?? item.name}
        </Text>
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

export default function SearchScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const inputRef = useRef<TextInput>(null);

  const searchQuery = useCatalogStore(s => s.searchQuery);
  const searchResults = useCatalogStore(s => s.searchResults);
  const loading = useCatalogStore(s => s.loading);
  const error = useCatalogStore(s => s.error);
  const searchObjects = useCatalogStore(s => s.searchObjects);

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
      <ResultItem item={item} onPress={() => handleSelect(item.id)} />
    ),
    [handleSelect],
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
        <View style={styles.stateContainer}>
          <Text style={[styles.emptyIcon, { color: colors.textSecondary }]}>{'\u2605'}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Search for celestial objects by name
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            Try "Sirius", "Jupiter", or "M31"
          </Text>
        </View>
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
  resultName: { fontSize: 16, fontWeight: '600' },
  resultCatalog: { fontSize: 12, marginTop: 1 },
  resultType: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, color: '#fff', fontWeight: '600' },
});
