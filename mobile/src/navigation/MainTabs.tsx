import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import SearchScreen from '../screens/SearchScreen';
import AlarmsScreen from '../screens/AlarmsScreen';
import type { MainTabParamList } from './types';
import { useTheme } from '../theme/ThemeContext';
import {
  renderHeaderTitle,
  renderSearchTabIcon,
  renderAlarmsTabIcon,
} from './NavigationComponents';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs(): React.JSX.Element {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTitle: renderHeaderTitle,
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary + '80',
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 78 : 56,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 22 : 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1.0,
          textTransform: 'uppercase',
        },
      }}>
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          tabBarIcon: renderSearchTabIcon,
        }}
      />
      <Tab.Screen
        name="Alarms"
        component={AlarmsScreen}
        options={{
          title: 'Alarms',
          tabBarIcon: renderAlarmsTabIcon,
        }}
      />
    </Tab.Navigator>
  );
}
