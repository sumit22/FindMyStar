import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useEntitlementStore } from '../store/entitlementStore';
import { PlanType } from '../native/FindMyStarCore';
import { mockConfig } from '../purchase/MockPurchaseAdapter';

function DevButton({
  label,
  color,
  onPress,
  compact,
}: {
  label: string;
  color: string;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.devButton, compact && styles.compactButton, { borderColor: color }]}
      onPress={onPress}>
      <Text style={[styles.devButtonText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DevSettingsPanel(): React.JSX.Element {
  const { colors } = useTheme();
  const isPro = useEntitlementStore(s => s.isPro);
  const planType = useEntitlementStore(s => s.planType);
  const validUntilMs = useEntitlementStore(s => s.validUntilMs);
  const activateEntitlement = useEntitlementStore(s => s.activateEntitlement);
  const clearEntitlement = useEntitlementStore(s => s.clearEntitlement);
  const loadEntitlement = useEntitlementStore(s => s.loadEntitlement);

  const [expanded, setExpanded] = useState(false);

  const formatExpiry = () => {
    if (!validUntilMs) {
      return 'Never (lifetime)';
    }
    const remaining = validUntilMs - Date.now();
    if (remaining <= 0) {
      return 'EXPIRED';
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}m ${secs}s remaining`;
  };

  const handleActivateLifetime = useCallback(async () => {
    await activateEntitlement(PlanType.Lifetime, 0);
    Alert.alert('Dev', 'Lifetime Pro activated');
  }, [activateEntitlement]);

  const handleActivateSubscription = useCallback(async () => {
    const validUntil = Date.now() + mockConfig.subscriptionDurationMs;
    await activateEntitlement(PlanType.Subscription, validUntil);
    Alert.alert(
      'Dev',
      `Subscription activated (expires in ${mockConfig.subscriptionDurationMs / 60000} min)`,
    );
  }, [activateEntitlement]);

  const handleClear = useCallback(async () => {
    await clearEntitlement();
    Alert.alert('Dev', 'Entitlement cleared, reset to Free');
  }, [clearEntitlement]);

  const handleReload = useCallback(async () => {
    await loadEntitlement();
    Alert.alert('Dev', 'Entitlement reloaded from DB (signature re-verified)');
  }, [loadEntitlement]);

  const handleForceError = useCallback((error: typeof mockConfig.forceError) => {
    mockConfig.forceError = error;
    Alert.alert('Dev', `Next purchase will fail with: ${error}`);
  }, []);

  const handleSetDuration = useCallback((minutes: number) => {
    mockConfig.subscriptionDurationMs = minutes * 60 * 1000;
    Alert.alert('Dev', `Subscription duration set to ${minutes} min`);
  }, []);

  if (!expanded) {
    return (
      <TouchableOpacity
        style={[styles.expandButton, { borderColor: colors.warning }]}
        onPress={() => setExpanded(true)}>
        <Text style={[styles.expandText, { color: colors.warning }]}>
          DEV: Entitlement Controls
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { borderColor: colors.warning, backgroundColor: colors.warning + '08' },
      ]}>
      <TouchableOpacity onPress={() => setExpanded(false)}>
        <Text style={[styles.header, { color: colors.warning }]}>
          DEV: Entitlement Controls (tap to collapse)
        </Text>
      </TouchableOpacity>

      <View
        style={[
          styles.statusCard,
          { backgroundColor: colors.cardBackground, borderColor: colors.border },
        ]}>
        <Text style={[styles.statusText, { color: colors.text }]}>
          Status: {isPro ? 'PRO' : 'FREE'} | Plan: {planType}
        </Text>
        <Text style={[styles.statusText, { color: colors.textSecondary }]}>
          Expiry: {isPro ? formatExpiry() : 'N/A'}
        </Text>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DIRECT ACTIVATION</Text>
      <DevButton
        label="Activate Lifetime"
        color={colors.success}
        onPress={handleActivateLifetime}
      />
      <DevButton
        label="Activate Subscription"
        color={colors.success}
        onPress={handleActivateSubscription}
      />
      <DevButton label="Clear Entitlement" color={colors.error} onPress={handleClear} />
      <DevButton label="Reload from DB" color={colors.primary} onPress={handleReload} />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        MOCK PURCHASE ERRORS
      </Text>
      <DevButton
        label="Force: cancelled"
        color={colors.warning}
        onPress={() => handleForceError('cancelled')}
      />
      <DevButton
        label="Force: network"
        color={colors.warning}
        onPress={() => handleForceError('network')}
      />
      <DevButton
        label="Force: already_owned"
        color={colors.warning}
        onPress={() => handleForceError('already_owned')}
      />

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        SUBSCRIPTION DURATION
      </Text>
      <View style={styles.row}>
        {[1, 2, 5, 10].map(min => (
          <DevButton
            key={min}
            label={`${min}m`}
            color={
              mockConfig.subscriptionDurationMs === min * 60000
                ? colors.primary
                : colors.textSecondary
            }
            onPress={() => handleSetDuration(min)}
            compact
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  expandButton: {
    margin: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  expandText: { fontSize: 14, fontWeight: '600' },
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  header: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  statusCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusText: { fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  devButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    alignItems: 'center',
  },
  compactButton: {
    flex: 1,
    marginHorizontal: 2,
  },
  devButtonText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 4 },
});
