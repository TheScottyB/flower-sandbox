import AsyncStorage from '@react-native-async-storage/async-storage';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: () => {},
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.ReactNode {
  const systemScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem('themeMode')
      .then((storedMode) => {
        if (
          storedMode === 'light' ||
          storedMode === 'dark' ||
          storedMode === 'system'
        ) {
          setThemeModeState(storedMode as ThemeMode);
        }
      })
      .catch(() => {});
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem('themeMode', mode).catch(() => {});
  };

  const isDark =
    themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

export const colors = {
  light: {
    backgroundStart: '#FFEBCD', // BlanchedAlmond
    backgroundEnd: '#FFF8E1',
    cardBackground: 'rgba(255, 255, 255, 0.55)',
    cardBorder: 'rgba(255, 255, 255, 0.5)',
    textPrimary: '#1F2937', // dark gray
    textSecondary: '#64748B', // gray-slate
    textHeader: '#333333',
    buttonBackground: '#007AFF',
    buttonText: '#FFFFFF',
    tabBarBackground: 'rgba(255, 255, 255, 0.65)',
    tabBarBorder: 'rgba(255, 255, 255, 0.5)',
    tabBarUnfocused: '#718096',
    tabBarFocused: '#007AFF',
    statusBanner: 'rgba(0, 0, 0, 0.03)',
    statusLabel: '#555555',
    planCardBackground: 'rgba(255, 255, 255, 0.55)',
    planCardBorder: 'rgba(255, 228, 181, 0.8)',
    priceBadgeBackground: 'rgba(255, 240, 219, 0.8)',
    priceBadgeBorder: 'rgba(255, 213, 153, 0.8)',
    priceBadgeText: '#B86E00',
    sandboxBackground: '#FFEBCD',
    sandboxBorder: '#8C7A6B',
    successBackground: '#DCFCE7',
    successBorder: '#6EE7B7',
    successText: '#166534',
    errorBackground: '#FEE2E2',
    errorBorder: '#FECACA',
    errorText: '#DC2626',
    textInputBackground: '#FFFFFF',
    textInputText: '#1F2937',
    textInputBorder: '#E2E8F0',
    textInputPlaceholder: '#94A3B8',
    aboutAppCardBackground: 'rgba(255, 255, 255, 0.55)',
    aboutAppCardBorder: 'rgba(255, 255, 255, 0.5)',
    aboutTitleText: '#333333',
    aboutSubtitleText: '#555555',
    versionText: '#777777',
    syncButtonBorder: '#007AFF',
  },
  dark: {
    backgroundStart: '#111827', // dark slate
    backgroundEnd: '#1F2937',
    cardBackground: 'rgba(31, 41, 55, 0.65)', // dark gray overlay
    cardBorder: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#F9FAFB', // off-white
    textSecondary: '#9CA3AF', // light gray
    textHeader: '#F3F4F6',
    buttonBackground: '#3B82F6',
    buttonText: '#FFFFFF',
    tabBarBackground: 'rgba(31, 41, 55, 0.75)',
    tabBarBorder: 'rgba(255, 255, 255, 0.1)',
    tabBarUnfocused: '#9CA3AF',
    tabBarFocused: '#3B82F6',
    statusBanner: 'rgba(255, 255, 255, 0.05)',
    statusLabel: '#D1D5DB',
    planCardBackground: 'rgba(55, 65, 81, 0.55)',
    planCardBorder: 'rgba(107, 114, 128, 0.5)',
    priceBadgeBackground: 'rgba(55, 65, 81, 0.8)',
    priceBadgeBorder: 'rgba(75, 85, 99, 0.8)',
    priceBadgeText: '#FBBF24', // yellow amber
    sandboxBackground: '#1F2937',
    sandboxBorder: '#4B5563',
    successBackground: '#064E3B', // dark green
    successBorder: '#047857',
    successText: '#A7F3D0',
    errorBackground: '#7F1D1D', // dark red
    errorBorder: '#B91C1C',
    errorText: '#FCA5A5',
    textInputBackground: '#374151',
    textInputText: '#F9FAFB',
    textInputBorder: '#4B5563',
    textInputPlaceholder: '#9CA3AF',
    aboutAppCardBackground: 'rgba(31, 41, 55, 0.65)',
    aboutAppCardBorder: 'rgba(255, 255, 255, 0.1)',
    aboutTitleText: '#F3F4F6',
    aboutSubtitleText: '#D1D5DB',
    versionText: '#9CA3AF',
    syncButtonBorder: '#3B82F6',
  },
};

export function useThemeColors() {
  const { isDark } = useThemeMode();
  return colors[isDark ? 'dark' : 'light'];
}
