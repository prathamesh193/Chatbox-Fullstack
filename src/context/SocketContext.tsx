// src/context/SocketContext.tsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import io, { Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ENV } from "../utils/env";

interface ISocketContext {
  socket: Socket | null;
  userId: string | null;
  emitTyping: (toUserId: string, isTyping: boolean) => void;
  emitMessageRead: (messageId: string, senderId: string) => void;
  emitReadAllMessages: (chatPartnerId: string) => void;
  isConnected: boolean;
}

const SocketContext = createContext<ISocketContext>({
  socket: null,
  userId: null,
  emitTyping: () => {},
  emitMessageRead: () => {},
  emitReadAllMessages: () => {},
  isConnected: false,
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const previousUserIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let mounted = true;
    let checkInterval: NodeJS.Timeout | null = null;

    const initSocket = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const uid = await AsyncStorage.getItem("userId");

        if (!token || !uid) {
          console.log("❌ No token/userId found — skipping socket connect");
          
          if (socketRef.current) {
            console.log("🔌 Disconnecting socket due to missing credentials");
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setIsConnected(false);
          }
          setUserId(null);
          previousUserIdRef.current = null;
          return;
        }

        if (!mounted) return;

        if (previousUserIdRef.current && previousUserIdRef.current !== uid) {
          console.log("🔄 USER CHANGED! Old:", previousUserIdRef.current, "New:", uid);
          console.log("🔌 Disconnecting old socket connection...");
          
          if (socketRef.current) {
            try {
              socketRef.current.disconnect();
              socketRef.current = null;
              setSocket(null);
              setIsConnected(false);
            } catch (e) {
              console.log("Error disconnecting old socket:", e);
            }
          }
        }

        setUserId(uid);
        previousUserIdRef.current = uid;

        if (socketRef.current?.connected && previousUserIdRef.current === uid) {
          console.log("✅ Socket already connected for this user");
          setIsConnected(true);
          return;
        }

        console.log("🔌 Creating new socket connection for userId:", uid);

        const newSocket = io(ENV.API_URL, {
          transports: ["websocket"],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000,
        });

        newSocket.on("connect", () => {
          console.log("🟢 SOCKET CONNECTED", newSocket?.id, "for user:", uid);
          setIsConnected(true);
          newSocket.emit("join", { userId: uid });
        });

        newSocket.on("disconnect", (reason) => {
          console.log("🔴 SOCKET DISCONNECTED", reason);
          setIsConnected(false);
        });

        newSocket.on("connect_error", (err: any) => {
          console.log("❌ SOCKET CONNECT ERROR", err?.message || err);
          setIsConnected(false);
        });

        newSocket.on("error", (err: any) => {
          console.log("⚠️ SOCKET ERROR", err);
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

      } catch (err) {
        console.log("❌ SOCKET INIT ERROR:", err);
        setIsConnected(false);
      }
    };

    initSocket();

    checkInterval = setInterval(async () => {
      try {
        const currentUid = await AsyncStorage.getItem("userId");
        
        if (currentUid !== previousUserIdRef.current) {
          console.log("📱 Detected userId change via polling");
          initSocket();
        }
      } catch (e) {
        console.log("Error checking userId:", e);
      }
    }, 2000);

    return () => {
      mounted = false;
      
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      
      if (socketRef.current) {
        try {
          console.log("🧹 Cleaning up socket connection");
          socketRef.current.disconnect();
          socketRef.current = null;
        } catch (e) {
          console.log("Error during socket cleanup:", e);
        }
      }
      
      setSocket(null);
      setUserId(null);
      setIsConnected(false);
    };
  }, []);

  const emitTyping = (toUserId: string, isTyping: boolean) => {
    if (!socket || !socket.connected) {
      console.log("⚠️ Cannot emit typing - socket not connected");
      return;
    }
    console.log("📤 [TYPING]", { isTyping, to: toUserId, from: userId });
    socket.emit(isTyping ? "typing" : "stopTyping", { 
      to: toUserId,
      from: userId 
    });
  };

  const emitMessageRead = (messageId: string, senderId: string) => {
    if (!socket || !socket.connected) {
      console.log("⚠️ Cannot emit messageRead - socket not connected");
      return;
    }
    socket.emit("messageRead", { messageId, senderId });
  };

  const emitReadAllMessages = (chatPartnerId: string) => {
    if (!socket || !socket.connected) {
      console.log("⚠️ Cannot emit readMessages - socket not connected");
      return;
    }
    socket.emit("readMessages", { chatPartnerId });
  };

  // In the SocketContext.tsx, inside the SocketProvider component, add this useEffect:

useEffect(() => {
  // Log socket status whenever it changes
  console.log("🔌 [SOCKET CONTEXT] Socket status:", {
    connected: socket?.connected,
    id: socket?.id,
    userId
  });
}, [socket, userId]);

  return (
    <SocketContext.Provider value={{ 
      socket, 
      userId, 
      emitTyping,
      emitMessageRead,
      emitReadAllMessages,
      isConnected
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);