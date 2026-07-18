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

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
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
    backgroundStart: '#0B1220',
    backgroundEnd: '#172338',
    cardBackground: 'rgba(20, 31, 49, 0.86)',
    cardBorder: 'rgba(148, 163, 184, 0.18)',
    textPrimary: '#F8FAFC',
    textSecondary: '#B7C2D2',
    textHeader: '#F3F4F6',
    buttonBackground: '#4C8DFF',
    buttonText: '#FFFFFF',
    tabBarBackground: 'rgba(15, 24, 39, 0.94)',
    tabBarBorder: 'rgba(148, 163, 184, 0.2)',
    tabBarUnfocused: '#A8B3C4',
    tabBarFocused: '#60A5FA',
    statusBanner: 'rgba(148, 163, 184, 0.1)',
    statusLabel: '#CBD5E1',
    planCardBackground: 'rgba(30, 43, 64, 0.82)',
    planCardBorder: 'rgba(96, 165, 250, 0.22)',
    priceBadgeBackground: 'rgba(245, 158, 11, 0.14)',
    priceBadgeBorder: 'rgba(251, 191, 36, 0.32)',
    priceBadgeText: '#FBBF24',
    sandboxBackground: '#101A2B',
    sandboxBorder: '#526176',
    successBackground: '#073D32',
    successBorder: '#0F766E',
    successText: '#A7F3D0',
    errorBackground: '#521D28',
    errorBorder: '#9F3347',
    errorText: '#FCA5A5',
    textInputBackground: '#1C2A40',
    textInputText: '#F8FAFC',
    textInputBorder: '#42526A',
    textInputPlaceholder: '#93A4B8',
    aboutAppCardBackground: 'rgba(20, 31, 49, 0.86)',
    aboutAppCardBorder: 'rgba(148, 163, 184, 0.18)',
    aboutTitleText: '#F3F4F6',
    aboutSubtitleText: '#D1D5DB',
    versionText: '#A8B3C4',
    syncButtonBorder: '#60A5FA',
  },
};

export function useThemeColors() {
  const { isDark } = useThemeMode();
  return colors[isDark ? 'dark' : 'light'];
}
