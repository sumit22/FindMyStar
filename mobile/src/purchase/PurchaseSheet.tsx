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
          style={[styles.sheet, { backgroundColor: colors.cardBackground }]}
          onStartShouldSetResponder={() => true}>
          <Text style={[styles.title, { color: colors.text }]}>Upgrade to Pro</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Unlock all celestial objects, AR tracking, and alerts.
          </Text>

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
                <View style={[styles.priceButton, { backgroundColor: colors.primary }]}>
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

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Restore previous purchases">
            {loading && selectedSku === '__restore__' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.restoreText, { color: colors.primary }]}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '85%',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  productInfo: { flex: 1, marginRight: 12 },
  productTitle: { fontSize: 16, fontWeight: '600' },
  productDesc: { fontSize: 12, marginTop: 2 },
  priceButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  priceText: { fontSize: 14, fontWeight: '700' },
  restoreButton: { alignItems: 'center', paddingVertical: 14 },
  restoreText: { fontSize: 14, fontWeight: '500' },
  cancelButton: { alignItems: 'center', paddingTop: 4 },
  cancelText: { fontSize: 15 },
});
