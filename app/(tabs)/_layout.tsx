import { Tabs } from 'expo-router';
import { Home, Info, CreditCard } from 'lucide-react-native';
import { View, StyleSheet, useWindowDimensions, Platform, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import React from 'react';

// Custom Animated Tab Button
function TabBarButton({ isFocused, label, icon: Icon, onPress, onLongPress }: any) {
  const scale = useSharedValue(isFocused ? 1.15 : 1);

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1.18 : 1, {
      damping: 15,
      stiffness: 180,
    });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.iconWrapper, animatedStyle]}>
        <Icon size={24} color={isFocused ? '#007AFF' : '#718096'} />
      </Animated.View>
      <View style={[styles.dot, { backgroundColor: isFocused ? '#007AFF' : 'transparent' }]} />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => {
        const { state, descriptors, navigation } = props;

        return (
          <View style={[
            styles.tabBarWrapper, 
            { bottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16 }
          ]}>
            <BlurView intensity={80} tint="light" style={styles.blurContainer}>
              <View style={styles.tabBarContainer}>
                {state.routes.map((route, index) => {
                  const { options } = descriptors[route.key];
                  const label = options.title !== undefined ? options.title : route.name;
                  const isFocused = state.index === index;

                  const onPress = () => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  };

                  const onLongPress = () => {
                    navigation.emit({
                      type: 'tabLongPress',
                      target: route.key,
                    });
                  };

                  let Icon = Home;
                  if (route.name === 'about') Icon = Info;
                  if (route.name === 'subscription') Icon = CreditCard;

                  return (
                    <TabBarButton
                      key={route.key}
                      isFocused={isFocused}
                      label={label}
                      icon={Icon}
                      onPress={onPress}
                      onLongPress={onLongPress}
                    />
                  );
                })}
              </View>
            </BlurView>
          </View>
        );
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: 'Subscription',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignSelf: 'center',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  blurContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tabBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});