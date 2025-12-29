// App.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/Appnavigator';
import { SocketProvider } from './src/context/SocketContext';

const App = () => {
  return (
    <SafeAreaProvider>
      <SocketProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <AppNavigator />
        </NavigationContainer>
      </SocketProvider>
    </SafeAreaProvider>
  );
};

export default App;
