import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, useWindowDimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Flower } from '@/src/components/Flower';
import { BlurView } from 'expo-blur';

export default function DonationSuccessScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const flowerPositions = isWide
    ? [
        { type: 'sunflower' as const, size: 85, position: { x: width * 0.08, y: 120 } },
        { type: 'rose' as const, size: 75, position: { x: width * 0.88, y: 180 } },
        { type: 'daisy' as const, size: 65, position: { x: width * 0.84, y: 420 } },
        { type: 'tulip' as const, size: 70, position: { x: width * 0.12, y: 350 } },
        { type: 'rose' as const, size: 75, position: { x: width * 0.2, y: 180 } },
        { type: 'daisy' as const, size: 65, position: { x: width * 0.78, y: 300 } },
      ]
    : [
        { type: 'sunflower' as const, size: 65, position: { x: 30, y: 60 } },
        { type: 'rose' as const, size: 55, position: { x: width - 60, y: 100 } },
        { type: 'daisy' as const, size: 45, position: { x: width - 40, y: 220 } },
        { type: 'tulip' as const, size: 50, position: { x: 35, y: 180 } },
        { type: 'rose' as const, size: 55, position: { x: 45, y: 290 } },
        { type: 'daisy' as const, size: 45, position: { x: width - 80, y: 340 } },
      ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#FFEBCD', '#FFF8E1']}
        style={styles.background}
      />
      
      {/* Celebration flowers */}
      <View style={styles.celebrationFlowers} pointerEvents="none">
        {flowerPositions.map((flower, idx) => (
          <Flower
            key={idx}
            type={flower.type}
            size={flower.size}
            position={flower.position}
          />
        ))}
      </View>
      
      <View style={styles.container}>
        <View style={styles.card}>
          <BlurView intensity={80} tint="light" style={styles.cardBlur}>
            <View style={styles.cardInner}>
              <View style={styles.iconContainer}>
                <Flower type="sunflower" size={80} />
              </View>
              
              <Text style={styles.title}>Thank You! 🎉</Text>
              <Text style={styles.message}>
                Your donation has been successfully processed. We truly appreciate your support!
              </Text>
              <Text style={styles.subMessage}>
                More beautiful flowers will bloom in the sandbox thanks to your generosity.
              </Text>
              
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/')}>
                <Text style={styles.buttonText}>Return to Sandbox</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFEBCD',
  },
  background: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  celebrationFlowers: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  card: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 24,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  cardBlur: {
    width: '100%',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(255, 255, 255, 0.55)',
  },
  cardInner: {
    padding: 28,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 26,
  },
  subMessage: {
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
    marginBottom: 28,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});