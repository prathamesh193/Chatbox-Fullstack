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
  emitDeleteForEveryone: (messageId: string, toUserId: string) => void;
}

const SocketContext = createContext<ISocketContext>({
  socket: null,
  userId: null,
  emitTyping: () => {},
  emitMessageRead: () => {},
  emitReadAllMessages: () => {},
  emitDeleteForEveryone: () => {},
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
          
          // If no credentials, disconnect existing socket
          if (socketRef.current) {
            console.log("🔌 Disconnecting socket due to missing credentials");
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
          }
          setUserId(null);
          previousUserIdRef.current = null;
          return;
        }

        if (!mounted) return;

        // CRITICAL: Check if userId has changed (account switch)
        if (previousUserIdRef.current && previousUserIdRef.current !== uid) {
          console.log("🔄 USER CHANGED! Old:", previousUserIdRef.current, "New:", uid);
          console.log("🔌 Disconnecting old socket connection...");
          
          // Disconnect old socket
          if (socketRef.current) {
            try {
              socketRef.current.disconnect();
              socketRef.current = null;
              setSocket(null);
            } catch (e) {
              console.log("Error disconnecting old socket:", e);
            }
          }
          
          // Small delay to ensure clean disconnect
          // await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update userId
        setUserId(uid);
        previousUserIdRef.current = uid;

        // If socket already exists for this user, don't reconnect
        if (socketRef.current?.connected && previousUserIdRef.current === uid) {
          console.log("✅ Socket already connected for this user");
          return;
        }

        console.log("🔌 Creating new socket connection for userId:", uid);

        // Create new socket
        const newSocket = io(ENV.API_URL, {
          transports: ["websocket"],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        newSocket.on("connect", () => {
          console.log("🟢 SOCKET CONNECTED", newSocket?.id, "for user:", uid);
          // Join the user's room
          newSocket.emit("join", { userId: uid });
        });

        newSocket.on("disconnect", (reason) => {
          console.log("🔴 SOCKET DISCONNECTED", reason);
        });

        newSocket.on("connect_error", (err: any) => {
          console.log("❌ SOCKET CONNECT ERROR", err?.message || err);
        });

        // Store socket instance
        socketRef.current = newSocket;
        setSocket(newSocket);

      } catch (err) {
        console.log("❌ SOCKET INIT ERROR:", err);
      }
    };

    // Initial connection
    initSocket();

    // Poll AsyncStorage periodically to detect account changes
    // This catches cases where logout/login happens without unmounting the provider
    checkInterval = setInterval(async () => {
      try {
        const currentUid = await AsyncStorage.getItem("userId");
        
        // If userId in storage differs from our state, reinitialize
        if (currentUid !== previousUserIdRef.current) {
          console.log("📱 Detected userId change via polling");
          initSocket();
        }
      } catch (e) {
        console.log("Error checking userId:", e);
      }
    }, 2000); // Check every 2 seconds

    // CLEANUP FUNCTION
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
    };
  }, []);

  // typing helper
  const emitTyping = (toUserId: string, isTyping: boolean) => {
    if (!socket || !socket.connected) {
      console.log("⚠️ Cannot emit typing - socket not connected");
      return;
    }
    socket.emit(isTyping ? "typing" : "stopTyping", { to: toUserId });
  };

  // mark single message as read
  const emitMessageRead = (messageId: string, senderId: string) => {
    if (!socket || !socket.connected) {
      console.log("⚠️ Cannot emit messageRead - socket not connected");
      return;
    }
    socket.emit("messageRead", { messageId, senderId });
  };

  // mark all messages as read for a chat
  const emitReadAllMessages = (chatPartnerId: string) => {
    if (!socket || !socket.connected) {
      console.log("⚠️ Cannot emit readMessages - socket not connected");
      return;
    }
    socket.emit("readMessages", { chatPartnerId });
  };

  // delete message for everyone
const emitDeleteForEveryone = (messageId: string, toUserId: string) => {
  if (!socket || !socket.connected) {
    console.log("⚠️ Cannot emit delete - socket not connected");
    return;
  }

  socket.emit("deleteMessageForEveryone", {
    messageId,
    to: toUserId,
  });
};


  return (
    <SocketContext.Provider value={{ 
      socket, 
      userId, 
      emitTyping,
      emitMessageRead,
      emitReadAllMessages,
      emitDeleteForEveryone,
    }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);