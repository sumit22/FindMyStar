import { create } from 'zustand';

type ThemePref = 'dark' | 'light' | 'system';

interface PreferencesState {
  theme: ThemePref;
  notificationsEnabled: boolean;
  minAltitudeDefault: number;

  setTheme: (theme: ThemePref) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMinAltitudeDefault: (altitude: number) => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  theme: 'dark',
  notificationsEnabled: true,
  minAltitudeDefault: 10,

  setTheme: (theme) => set({ theme }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setMinAltitudeDefault: (altitude) => set({ minAltitudeDefault: altitude }),
}));
