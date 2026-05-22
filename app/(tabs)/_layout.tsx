import { Tabs } from 'expo-router';
import { Home, Info, CreditCard } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#007AFF',
        tabBarStyle: {
          elevation: 0,
          borderTopWidth: 0.5,
          borderTopColor: '#E5E5E5',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          tabBarIcon: ({ size, color }) => <Info size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: 'Subscription',
          tabBarIcon: ({ size, color }) => <CreditCard size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}