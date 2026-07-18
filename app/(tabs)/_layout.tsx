import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { CreditCard, Home, Info } from 'lucide-react-native';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors, useThemeMode } from '@/src/hooks/useThemeColors';

// Custom Animated Tab Button
function TabBarButton({
  isFocused,
  label,
  icon: Icon,
  onPress,
  onLongPress,
  testID,
}: any) {
  const scale = useSharedValue(isFocused ? 1.1 : 1);
  const theme = useThemeColors();

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1.1 : 1, {
      damping: 15,
      stiffness: 180,
    });
  }, [isFocused, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.7}
      testID={testID}
    >
      <Animated.View style={[styles.iconWrapper, animatedStyle]}>
        <Icon
          size={20}
          color={isFocused ? theme.tabBarFocused : theme.tabBarUnfocused}
        />
      </Animated.View>
      <Text
        style={[
          styles.label,
          { color: isFocused ? theme.tabBarFocused : theme.tabBarUnfocused },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useThemeColors();
  const { isDark } = useThemeMode();

  const isLargeScreen = width > 768;
  const tabBarWidth = isLargeScreen ? 400 : width - 40;
  const tabBarLeft = (width - tabBarWidth) / 2;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => {
        const { state, descriptors, navigation } = props;

        return (
          <View
            style={[
              styles.tabBarWrapper,
              {
                bottom:
                  Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16,
                backgroundColor: theme.tabBarBackground,
                borderColor: theme.tabBarBorder,
                width: tabBarWidth,
                left: tabBarLeft,
              },
            ]}
          >
            <BlurView
              intensity={80}
              tint={isDark ? 'dark' : 'light'}
              style={[
                styles.blurContainer,
                { backgroundColor: theme.tabBarBackground },
              ]}
            >
              <View style={styles.tabBarContainer}>
                {state.routes.map((route, index) => {
                  const { options } = descriptors[route.key];
                  const label =
                    options.title !== undefined ? options.title : route.name;
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
                      testID={`tab-button-${route.name}`}
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
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  blurContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    paddingVertical: 4,
  },
  iconWrapper: {
    padding: 2,
    borderRadius: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
});
