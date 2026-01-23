import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENV } from "./env";

// CRITICAL: baseURL should be JUST the base URL, NOT including /api
export const api = axios.create({
  baseURL: ENV.API_URL,  // This should be: http://139.59.87.161:3000
  timeout: 30000,
});
// Delete message for me
export const deleteMessageForMe = (messageId: string) => {
  return api.delete(`/api/messages/${messageId}/for-me`);
};

// Delete message for everyone
export const deleteMessageForEveryone = (messageId: string) => {
  return api.delete(`/api/messages/${messageId}/for-everyone`);
};

export const clearChatApi = (otherUserId: string) => {
  return api.delete(`/api/messages/clear-chat/${otherUserId}`);
};


// Add auth token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error logs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("🔴 API ERROR");
    console.error("URL:", error?.config?.url);
    console.error("BASE URL:", error?.config?.baseURL);
    console.error("STATUS:", error?.response?.status);
    console.error("MESSAGE:", error?.response?.data || error.message);
    return Promise.reject(error);
  }
);


export const authApi = api;