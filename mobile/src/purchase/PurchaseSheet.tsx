import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { PRODUCTS, type Product } from './PurchaseAdapter';
import { usePurchase } from './usePurchase';

interface PurchaseSheetProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete: () => void;
}

export default function PurchaseSheet({
  visible,
  onClose,
  onPurchaseComplete,
}: PurchaseSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const { purchase, restore, loading } = usePurchase();
  const [selectedSku, setSelectedSku] = useState<string | null>(null);

  const handlePurchase = async (product: Product) => {
    setSelectedSku(product.sku);
    const success = await purchase(product);
    setSelectedSku(null);
    if (success) {
      onPurchaseComplete();
      onClose();
    }
  };

  const handleRestore = async () => {
    setSelectedSku('__restore__');
    const success = await restore();
    setSelectedSku(null);
    if (success) {
      onPurchaseComplete();
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.cardBackground, borderColor: colors.border },
          ]}
          onStartShouldSetResponder={() => true}>
          {/* Header */}
          <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>UPGRADE</Text>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>FindMyStar Pro</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
            All objects, AR tracking, and alerts.
          </Text>

          <View style={[styles.rule, { backgroundColor: colors.border }]} />

          {/* Products */}
          {PRODUCTS.map(product => {
            const isLoading = loading && selectedSku === product.sku;
            return (
              <TouchableOpacity
                key={product.sku}
                style={[styles.productCard, { borderColor: colors.border }]}
                onPress={() => handlePurchase(product)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={`${product.title} for ${product.price}`}>
                <View style={styles.productInfo}>
                  <Text style={[styles.productTitle, { color: colors.text }]}>{product.title}</Text>
                  <Text style={[styles.productDesc, { color: colors.textSecondary }]}>
                    {product.description}
                  </Text>
                </View>
                <View style={[styles.priceBtn, { backgroundColor: colors.primary }]}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.textInverse} />
                  ) : (
                    <Text style={[styles.priceText, { color: colors.textInverse }]}>
                      {product.price}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Restore */}
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Restore previous purchases">
            {loading && selectedSku === '__restore__' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.restoreText, { color: colors.primary }]}>RESTORE PURCHASES</Text>
            )}
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '78%',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  sheetLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, marginBottom: 6 },
  sheetTitle: { fontSize: 18, fontWeight: '300', marginBottom: 4 },
  sheetSubtitle: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
  rule: { height: StyleSheet.hairlineWidth, marginBottom: 14 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    marginBottom: 8,
  },
  productInfo: { flex: 1, marginRight: 10 },
  productTitle: { fontSize: 14, fontWeight: '500' },
  productDesc: { fontSize: 11, marginTop: 2, letterSpacing: 0.2 },
  priceBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  priceText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  restoreBtn: { alignItems: 'center', paddingVertical: 12 },
  restoreText: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
  cancelBtn: { alignItems: 'center', paddingTop: 2 },
  cancelText: { fontSize: 10, fontWeight: '600', letterSpacing: 1.2 },
});
