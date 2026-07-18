import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { useColorScheme } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { vi } from 'vitest';
import { colors, ThemeProvider, useThemeColors } from '../useThemeColors';

let renderedTheme: (typeof colors)['light'] | (typeof colors)['dark'];

function ThemeProbe() {
  renderedTheme = useThemeColors();
  return null;
}

async function renderTheme() {
  await act(async () => {
    TestRenderer.create(
      React.createElement(ThemeProvider, null, React.createElement(ThemeProbe)),
    );
    await Promise.resolve();
  });

  return renderedTheme;
}

describe('useThemeColors hook', () => {
  beforeEach(async () => {
    vi.mocked(useColorScheme).mockClear();
    await AsyncStorage.clear();
  });

  it('returns light theme colors when the system scheme is light', async () => {
    vi.mocked(useColorScheme).mockReturnValue('light');
    const theme = await renderTheme();
    expect(theme.backgroundStart).toBe(colors.light.backgroundStart);
    expect(theme.textPrimary).toBe(colors.light.textPrimary);
  });

  it('returns light theme colors when the system scheme is unavailable', async () => {
    vi.mocked(useColorScheme).mockReturnValue(null as never);
    const theme = await renderTheme();
    expect(theme.backgroundStart).toBe(colors.light.backgroundStart);
  });

  it('returns dark theme colors when the system scheme is dark', async () => {
    vi.mocked(useColorScheme).mockReturnValue('dark');
    const theme = await renderTheme();
    expect(theme.backgroundStart).toBe(colors.dark.backgroundStart);
    expect(theme.textPrimary).toBe(colors.dark.textPrimary);
  });

  it('lets a saved dark preference override a light system scheme', async () => {
    vi.mocked(useColorScheme).mockReturnValue('light');
    await AsyncStorage.setItem('themeMode', 'dark');
    const theme = await renderTheme();
    expect(theme.backgroundStart).toBe(colors.dark.backgroundStart);
  });

  it('lets a saved light preference override a dark system scheme', async () => {
    vi.mocked(useColorScheme).mockReturnValue('dark');
    await AsyncStorage.setItem('themeMode', 'light');
    const theme = await renderTheme();
    expect(theme.backgroundStart).toBe(colors.light.backgroundStart);
  });
});
