import { LinearGradient } from 'expo-linear-gradient';
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/src/hooks/useThemeColors';

export default function NotFoundScreen() {
  const theme = useThemeColors();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <LinearGradient
        colors={[theme.backgroundStart, theme.backgroundEnd]}
        style={styles.background}
      />
      <View style={styles.container}>
        <Text style={[styles.text, { color: theme.textPrimary }]}>
          This screen doesn't exist.
        </Text>
        <Link
          href="/"
          style={[styles.link, { backgroundColor: theme.buttonBackground }]}
        >
          <Text style={styles.linkText}>Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    zIndex: 1,
  },
  text: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 15,
  },
  link: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
