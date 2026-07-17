import { useColorScheme } from 'react-native';
import { vi } from 'vitest';
import { colors, useThemeColors } from '../useThemeColors';

describe('useThemeColors hook', () => {
  beforeEach(() => {
    vi.mocked(useColorScheme).mockClear();
  });

  it('returns light theme colors by default', () => {
    vi.mocked(useColorScheme).mockReturnValue('light');
    const theme = useThemeColors();
    expect(theme.backgroundStart).toBe(colors.light.backgroundStart);
    expect(theme.textPrimary).toBe(colors.light.textPrimary);
  });

  it('returns light theme colors when scheme is null/undefined', () => {
    // @ts-expect-error
    vi.mocked(useColorScheme).mockReturnValue(null);
    const theme = useThemeColors();
    expect(theme.backgroundStart).toBe(colors.light.backgroundStart);
  });

  it('returns dark theme colors when scheme is dark', () => {
    vi.mocked(useColorScheme).mockReturnValue('dark');
    const theme = useThemeColors();
    expect(theme.backgroundStart).toBe(colors.dark.backgroundStart);
    expect(theme.textPrimary).toBe(colors.dark.textPrimary);
  });
});
