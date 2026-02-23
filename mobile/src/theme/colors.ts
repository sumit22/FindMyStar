export interface AppColors {
  background: string;
  surface: string;
  primary: string;
  primaryDark: string;
  accent: string;
  text: string;
  textSecondary: string;
  textInverse: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  cardBackground: string;
  // AR-specific
  arOverlay: string;
  arArrow: string;
  arLocked: string;
}

export const darkColors: AppColors = {
  background: '#0A0E1A',
  surface: '#141828',
  primary: '#4A9EFF',
  primaryDark: '#2D7CD4',
  accent: '#FFB74D',
  text: '#E8EAF0',
  textSecondary: '#8892A4',
  textInverse: '#0A0E1A',
  border: '#2A3044',
  error: '#EF5350',
  success: '#66BB6A',
  warning: '#FFA726',
  cardBackground: '#1C2236',
  arOverlay: 'rgba(10, 14, 26, 0.6)',
  arArrow: '#4A9EFF',
  arLocked: '#66BB6A',
};

export const lightColors: AppColors = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  primary: '#1565C0',
  primaryDark: '#0D47A1',
  accent: '#FF8F00',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  border: '#E0E3E8',
  error: '#D32F2F',
  success: '#388E3C',
  warning: '#F57C00',
  cardBackground: '#FFFFFF',
  arOverlay: 'rgba(255, 255, 255, 0.6)',
  arArrow: '#1565C0',
  arLocked: '#388E3C',
};
