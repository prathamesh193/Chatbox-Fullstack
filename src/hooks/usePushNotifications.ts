import { useState, useEffect } from 'react';
import { pushService } from '../services/pushNotificationService';

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkInitialStatus();
  }, []);

  const checkInitialStatus = async (): Promise<void> => {
    try {
      setIsSupported(true);
      await initializePushNotifications();
    } catch (error) {
      console.error('Error checking push notification status:', error);
      setError('Push notifications not available');
    }
  };

  const initializePushNotifications = async (): Promise<boolean> => {
    try {
      const initialized = await pushService.initialize();
      setIsInitialized(initialized);
      setHasPermission(initialized);
      
      if (!initialized) {
        setError('Push notifications not enabled');
      }
      
      return initialized;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      setError('Failed to initialize push notifications');
      return false;
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      return await initializePushNotifications();
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  return {
    isSupported,
    isInitialized,
    hasPermission,
    error,
    requestPermission,
    initializePushNotifications,
  };
};