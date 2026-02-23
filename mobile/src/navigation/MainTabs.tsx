import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import SearchScreen from '../screens/SearchScreen';
import AlarmsScreen from '../screens/AlarmsScreen';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
      }}>
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: 'Search' }}
      />
      <Tab.Screen
        name="Alarms"
        component={AlarmsScreen}
        options={{ title: 'Alarms' }}
      />
    </Tab.Navigator>
  );
}
