import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import ObjectInfoScreen from '../screens/ObjectInfoScreen';
import ARScreen from '../screens/ARScreen';
import SettingsScreen from '../screens/SettingsScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="ObjectInfo"
        component={ObjectInfoScreen}
        options={{ headerShown: true, title: 'Object Details' }}
      />
      <Stack.Screen
        name="AR"
        component={ARScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: true, title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}
