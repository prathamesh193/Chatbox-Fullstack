// src/screens/ChatScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  ScrollView,
  Platform,
  StatusBar,
  LayoutAnimation,
  UIManager,
  Keyboard,
  KeyboardAvoidingView,  // <-- ADD THIS
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { useRoute, useNavigation } from "@react-navigation/native";
import { launchImageLibrary } from "react-native-image-picker";
import { pick, types } from "@react-native-documents/picker";
import { api } from "../utils/api";
import { COLORS } from "../constants/colors";
import { useSocket } from "../context/SocketContext";
import { ENV } from "../utils/env";
import { pushService } from "../services/pushNotificationService";
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import Video from 'react-native-video';
import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "@react-native-clipboard/clipboard";
import {  deleteMessageForMe,  deleteMessageForEveryone,} from "../utils/api";
import { clearChatApi } from "../utils/api";


type MessageType = {
  _id?: string;
  senderId?: string;
  receiverId?: string;
  text?: string | null;
  image?: string | null;
  document?: string | null;
  documentName?: string | null;
  documentType?: string | null;
  documentSize?: number | null;
  status?: "sent" | "delivered" | "read";
  createdAt?: string;
  isDeletedForEveryone?: boolean;

};

type SelectedImage = {
  uri: string;
  name?: string;
  type?: string;
};

type SelectedDocument = {
  uri: string;
  name: string;
  type: string;
  size: number;
};

const MAX_IMAGES = 10;
const MAX_DOCUMENTS = 5;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ChatScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId: chatPartnerId, name } = route.params || {};

  // Hide navigation header
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

const { socket, userId, emitTyping, emitDeleteForEveryone } = useSocket();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<MessageType> | null>(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByThem, setIsBlockedByThem] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<SelectedDocument[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewingSentImage, setViewingSentImage] = useState(false);

  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [sending, setSending] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  const [menuVisible, setMenuVisible] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [filteredMessages, setFilteredMessages] = useState<MessageType[] | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const [matchIndexes, setMatchIndexes] = useState<number[]>([]);
  const [currentMatchIdx, setCurrentMatchIdx] = useState<number>(0);

  const sentMessageIds = useRef(new Set<string>());

  const [pinnedMessage, setPinnedMessage] = useState<MessageType | null>(null);
  const [longPressMenuVisible, setLongPressMenuVisible] = useState(false);
  const [longPressTarget, setLongPressTarget] = useState<MessageType | null>(null);

  const PIN_STORAGE_KEY = (chatId: string) => `pinned:${chatId}`;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // -------------------------
  // Presence events
  // -------------------------
  useEffect(() => {
    if (!socket || !chatPartnerId) return;

    try {
      socket.emit("checkOnline", { userId: chatPartnerId });
    } catch (e) { }

    const onOnline = (payload: any) => {
      if (String(payload?.userId) === String(chatPartnerId)) setPartnerOnline(true);
    };
    const onOffline = (payload: any) => {
      if (String(payload?.userId) === String(chatPartnerId)) setPartnerOnline(false);
    };
    const onOnlineStatus = (payload: any) => {
      if (String(payload?.userId) === String(chatPartnerId)) {
        setPartnerOnline(Boolean(payload?.online));
      }
    };

    socket.on("userOnline", onOnline);
    socket.on("userOffline", onOffline);
    socket.on("onlineStatus", onOnlineStatus);

    return () => {
      socket.off("userOnline", onOnline);
      socket.off("userOffline", onOffline);
      socket.off("onlineStatus", onOnlineStatus);
    };
  }, [socket, chatPartnerId]);

  // -------------------------
  // Mark messages as read when opening chat
  // -------------------------
  useEffect(() => {
    if (!socket || !userId || !chatPartnerId) return;

    const unread = messages.filter(
      (msg) =>
        String(msg.senderId) === String(chatPartnerId) &&
        String(msg.receiverId) === String(userId) &&
        msg.status !== "read"
    );

    if (unread.length === 0) return;

    // Update local state
    setMessages((prev) =>
      prev.map((msg) =>
        String(msg.senderId) === String(chatPartnerId) && msg.status !== "read"
          ? { ...msg, status: "read" }
          : msg
      )
    );

    // Emit to socket
    socket.emit("readMessages", { chatPartnerId });

    // Update backend
    unread.forEach((msg) => {
      if (msg._id) {
        api.put(`/api/messages/read/${msg._id}`).catch(() => { });
      }
    });
  }, [socket, userId, chatPartnerId, messages.length]);

  // -------------------------
  // Block/Unblock handlers
  // -------------------------
  const handleBlockUser = async () => {
    try {
      setBlockLoading(true);
      const response = await api.post(`/api/users/block/${chatPartnerId}`);
      if (response.status === 200) {
        setIsBlocked(true);
        // Don't clear messages - keep them visible
        setShowBlockModal(false);
        Alert.alert("Blocked", "You blocked this contact");
      } else throw new Error("Block failed");
    } catch (error: any) {
      console.error("Block error:", error);
      if (error.response?.status === 404) Alert.alert("Error", "User not found");
      else if (error.response?.status === 400) Alert.alert("Error", error.response.data?.message || "Cannot block user");
      else Alert.alert("Error", "Failed to block user");
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockUser = async () => {
    try {
      setBlockLoading(true);
      const response = await api.post(`/api/users/unblock/${chatPartnerId}`);
      if (response.status === 200) {
        setIsBlocked(false);
        setIsBlockedByThem(false);
        Alert.alert("Unblocked", "You unblocked this contact");
      } else throw new Error("Unblock failed");
    } catch (error: any) {
      console.error("Unblock error:", error);
      if (error.response?.status === 404) Alert.alert("Error", "User not found");
      else if (error.response?.status === 404) Alert.alert("Error", "User not found");
      else Alert.alert("Error", "Failed to unblock user");
    } finally {
      setBlockLoading(false);
    }
  };

  // -------------------------
  // Socket: New messages
  // -------------------------
  useEffect(() => {
    if (!socket) return;

    const onNew = (msg: MessageType) => {
      const relevant =
        (String(msg.senderId) === String(chatPartnerId) && String(msg.receiverId) === String(userId)) ||
        (String(msg.receiverId) === String(chatPartnerId) && String(msg.senderId) === String(userId));

      if (!relevant) return;
      if (msg._id && sentMessageIds.current.has(msg._id)) return;

      setMessages((prev) => {
        const exists = prev.some((m) => m._id === msg._id);
        if (exists) return prev;

        // If I received this message (they sent it to me)
        if (String(msg.receiverId) === String(userId)) {
          const updatedMsg: MessageType = { ...msg, status: "read" };

          // Notify sender that I read it
          if (msg._id && msg.senderId) {
            socket.emit("messageRead", { messageId: msg._id, senderId: msg.senderId });
            api.put(`/api/messages/read/${msg._id}`).catch(() => { });
          }

          // Show notification
          if (msg.text && String(msg.senderId) !== String(userId)) {
            pushService
              .showLocalNotification(`New message from ${name}`, msg.text, {
                chatId: chatPartnerId,
                messageId: msg._id,
                type: "message",
              })
              .catch(() => { });
          }
          return [...prev, updatedMsg];
        }

        return [...prev, msg];
      });

      // Multiple scroll attempts for reliability
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
    };

    socket.on("newMessage", onNew);
    return () => {
      socket.off("newMessage", onNew);
    };
  }, [socket, chatPartnerId, userId, name]);

  // -------------------------
  // Socket: Message read receipts
  // -------------------------
  useEffect(() => {
    if (!socket) return;

    const onMessageRead = ({ messageId }: any) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, status: "read" } : msg
        )
      );
    };

    const onMessageReadAll = ({ readerId, chatPartnerId: partner }: any) => {
      if (String(partner) !== String(userId)) return;
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.senderId) === String(userId) ? { ...msg, status: "read" } : msg
        )
      );
    };

    socket.on("messageRead", onMessageRead);
    socket.on("messageReadAll", onMessageReadAll);

    return () => {
      socket.off("messageRead", onMessageRead);
      socket.off("messageReadAll", onMessageReadAll);
    };
  }, [socket, userId]);


  // -------------------------
  // Socket: Typing indicators
  // -------------------------
  useEffect(() => {
    if (!socket) return;

    const onTyping = ({ from }: any) => {
      // ONLY show typing if the OTHER person (chatPartner) is typing
      if (String(from) === String(chatPartnerId)) {
        setPartnerTyping(true);
      }
    };

    const onStop = ({ from }: any) => {
      if (String(from) === String(chatPartnerId)) {
        setPartnerTyping(false);
      }
    };

    socket.on("typing", onTyping);
    socket.on("stopTyping", onStop);

    return () => {
      socket.off("typing", onTyping);
      socket.off("stopTyping", onStop);
    };
  }, [socket, chatPartnerId]);

  useEffect(() => {
    // Force refresh when userId changes (account switch)
    if (userId) {
      console.log("User changed, refreshing view for userId:", userId);
      // Clear any cached state
      setMessages([]);
      setFilteredMessages(null);
      setPinnedMessage(null);
      setSearchQuery("");
      setSelectedImages([]);
      setSelectedDocuments([]);
      setLoading(true);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        // STEP 1: Load messages first (always show existing messages)
        const messagesRes = await api.get(`/api/messages/${chatPartnerId}`);
        const clearedAt = await AsyncStorage.getItem(`clearedAt:${chatPartnerId}`);
        let msgs = messagesRes.data || [];
        let clearedTime: number | null = null;

        if (clearedAt) {
          clearedTime = new Date(clearedAt).getTime();
          msgs = msgs.filter(
            (m: MessageType) =>
              m.createdAt &&
              new Date(m.createdAt).getTime() > clearedTime!
          );
        }

        setMessages((prev) => {
          const apiIds = new Set(msgs.map((m: MessageType) => m._id).filter((id: string | undefined) => id));
          const existingNewer = prev.filter((m) => {
            if (!m._id || apiIds.has(m._id)) return false;
            if (clearedTime && (!m.createdAt || new Date(m.createdAt).getTime() <= clearedTime)) return false;
            return true;
          });
          return [...msgs, ...existingNewer];
        });

        // STEP 2: Load pinned message
        try {
          const pinnedId = await AsyncStorage.getItem(PIN_STORAGE_KEY(chatPartnerId));
          if (pinnedId) {
            const found = (messagesRes.data || []).find((m: MessageType) => String(m._id) === String(pinnedId));
            if (found) setPinnedMessage(found);
            else {
              await AsyncStorage.removeItem(PIN_STORAGE_KEY(chatPartnerId));
              setPinnedMessage(null);
            }
          }
        } catch (pinErr) {
          setPinnedMessage(null);
        }

        // STEP 3: Check if I blocked them
        try {
          const blockedRes = await api.get(`/api/users/blocked`);
          const blockedUsers = blockedRes.data || [];
          const isBlockedLocal = blockedUsers.some((user: any) => user._id === chatPartnerId);
          setIsBlocked(isBlockedLocal);

          // If I didn't block them, they might have blocked me
          // We can't check this without backend, so just assume false
          setIsBlockedByThem(false);
        } catch (blockError) {
          setIsBlocked(false);
          setIsBlockedByThem(false);
        }
      } catch (err: any) {
        console.warn("load messages error", err);
        if (mounted) {
          // If we get 403, they might have blocked us
          if (err.response?.status === 403) {
            setIsBlockedByThem(true);
            setMessages([]); // Clear messages if they blocked us
          } else if (err.response?.status === 404) {
            Alert.alert("Error", "Chat not found");
          } else {
            Alert.alert("Error", "Cannot load messages");
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
        }
      }
    };
    if (chatPartnerId && userId) load();
    return () => {
      mounted = false;
    };
  }, [chatPartnerId, userId]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        setIsKeyboardVisible(true);

        // Multiple scroll attempts to ensure message visibility
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 150);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 300);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);

        // Scroll back to bottom when keyboard closes
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // useEffect(() => {
  //   const keyboardWillShow = Keyboard.addListener(
  //     Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
  //     (e) => {
  //       const keyboardHeight = e.endCoordinates.height;
  //       setKeyboardHeight(keyboardHeight);
  //       setIsKeyboardVisible(true);
  //     }
  //   );

  //   const keyboardWillHide = Keyboard.addListener(
  //     Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
  //     () => {
  //       setKeyboardHeight(0);
  //       setIsKeyboardVisible(false);
  //     }
  //   );

  //   return () => {
  //     keyboardWillShow.remove();
  //     keyboardWillHide.remove();
  //   };
  // }, []);

  // Auto-scroll to bottom when keyboard closes
  // useEffect(() => {
  //   if (!isKeyboardVisible && messages.length > 0) {
  //     // Small delay to ensure layout has updated
  //     setTimeout(() => {
  //       flatListRef.current?.scrollToEnd({ animated: true });
  //     }, 100);
  //   }
  // }, [isKeyboardVisible, messages.length]);

  // -------------------------
  // REMOVED: Auto status updater (was causing premature read status)
  // -------------------------

  // -------------------------
  // Helper functions
  // -------------------------
  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const pushMessage = (newMsg: MessageType) => {
    if (newMsg._id) sentMessageIds.current.add(newMsg._id);
    setMessages((prev) => {
      const exists = prev.some((m) => m._id === newMsg._id);
      if (exists) return prev;
      return [...prev, newMsg];
    });

    // Auto-scroll after adding message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 200);

    (async () => {
      try {
        const pinnedId = await AsyncStorage.getItem(PIN_STORAGE_KEY(chatPartnerId));
        if (pinnedId && newMsg._id && String(newMsg._id) === String(pinnedId)) {
          setPinnedMessage(newMsg);
        }
      } catch (e) { }
    })();
  };

  // -------------------------
  // Document Picker
  // -------------------------
  const pickDocuments = async () => {
    if (isBlocked) {
      Alert.alert("Blocked", "You cannot send messages to this user");
      return;
    }

    try {
      const results = await pick({
        allowMultiSelection: true,
        type: [types.allFiles],
      });

      if (results && results.length > 0) {
        const docs: SelectedDocument[] = results.slice(0, MAX_DOCUMENTS).map((doc) => ({
          uri: doc.uri,
          name: doc.name || "document",
          type: doc.type || "application/octet-stream",
          size: doc.size || 0,
        }));

        setSelectedDocuments((prev) => {
          const merged = [...prev, ...docs];
          return merged.slice(0, MAX_DOCUMENTS);
        });
      }
    } catch (err: any) {
      if (err && err.code !== "OPERATION_CANCELED") {
        console.warn("Document picker error:", err);
        Alert.alert("Error", "Failed to pick document");
      }
    }
  };

  // -------------------------
  // Image picker
  // -------------------------
  const pickImages = () => {
    if (isBlocked) {
      Alert.alert("Blocked", "You cannot send messages to this user");
      return;
    }

    launchImageLibrary(
      {
        mediaType: "mixed",  // This allows both photos and videos
        selectionLimit: MAX_IMAGES,
        includeBase64: false,
        videoQuality: 'high', // Add video quality
      },
      (res: any) => {
        if (!res || res.didCancel) return;
        if (!res.assets || res.assets.length === 0) return;

        setSelectedImages((prev) => {
          const prevUris = new Set(prev.map((p) => p.uri));
          const merged = [...prev];
          for (const a of res.assets) {
            if (!a.uri) continue;
            if (!prevUris.has(a.uri)) {
              merged.push({
                uri: a.uri,
                name: a.fileName,
                type: a.type || (a.uri.toLowerCase().includes('.mp4') ? 'video/mp4' : 'image/jpeg')
              });
              prevUris.add(a.uri);
            }
            if (merged.length >= MAX_IMAGES) break;
          }
          return merged.slice(0, MAX_IMAGES);
        });
        setShowAttachmentModal(false);
      }
    );
  };

  // Add helper function to check if file is video
  const isVideoFile = (uri: string, type?: string) => {
    if (type && type.startsWith('video/')) return true;
    const lower = uri.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.mov') ||
      lower.includes('.avi') || lower.includes('.mkv') ||
      lower.includes('.m4v') || lower.includes('.3gp');
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeSelectedDocument = (index: number) => {
    setSelectedDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const openSentImageViewer = (imageUri: string) => {
    setSelectedImages([{ uri: imageUri }]);
    setViewerIndex(0);
    setViewingSentImage(true);
    setViewerVisible(true);
  };

  const closeViewer = () => {
    setViewerVisible(false);
    if (viewingSentImage) {
      setSelectedImages([]);
      setViewingSentImage(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getDocumentIcon = (type: string): string => {
    if (type.includes("pdf")) return "📄";
    if (type.includes("word") || type.includes("document")) return "📄";
    if (type.includes("sheet") || type.includes("excel")) return "📊";
    if (type.includes("presentation") || type.includes("powerpoint")) return "📽️";
    if (type.includes("text")) return "📃";
    if (type.includes("zip") || type.includes("rar") || type.includes("compressed")) return "🗜️";
    if (type.includes("audio")) return "🎵";
    if (type.includes("video")) return "🎬";
    return "📎";
  };

  const looksLikeImageOrVideo = (url?: string) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes(".jpg") ||
      lower.includes(".jpeg") ||
      lower.includes(".png") ||
      lower.includes(".gif") ||
      lower.includes(".webp") ||
      lower.includes(".mp4") ||
      lower.includes(".mov") ||
      lower.includes(".mkv")
    );
  };

  const filenameFromUrl = (url?: string) => {
    if (!url) return "Document";
    const parts = url.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "Document");
  };

  const normalizeFileUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;

    // Replace localhost with server IP
    let processedUrl = url.replace(/localhost:3000/g, '139.59.87.161:3000');

    // If already a full URL, return it
    if (processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) {
      return processedUrl;
    }

    // Handle relative paths
    if (processedUrl.startsWith('/uploads')) {
      return `${ENV.API_URL}${processedUrl}`;
    }

    return `${ENV.API_URL}/uploads/${processedUrl}`;
  };


  const openDocument = async (url: string, filename: string) => {
    try {
      console.log("📥 [DOWNLOAD] Attempting download from:", url);

      // Validate URL
      if (!url.startsWith('http')) {
        Alert.alert("Error", "Invalid document URL");
        return;
      }

      // Determine file extension and mime type
      const extension = filename.split('.').pop()?.toLowerCase() || 'file';

      // Map extensions to mime types
      const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
      };

      const mimeType = mimeTypes[extension] || 'application/octet-stream';

      // Generate a safe filename with proper extension
      const safeFilename = `downloaded_${Date.now()}.${extension}`;
      const localPath = `${RNFS.DocumentDirectoryPath}/${safeFilename}`;

      // Delete existing file if it exists
      const exists = await RNFS.exists(localPath);
      if (exists) {
        await RNFS.unlink(localPath).catch(() => { });
      }

      // Download the file
      const options = {
        fromUrl: url,
        toFile: localPath,
      };

      console.log("📥 Downloading to:", localPath);
      const result = await RNFS.downloadFile(options).promise;

      if (result.statusCode && result.statusCode >= 400) {
        throw new Error(`Download failed, status: ${result.statusCode}`);
      }

      console.log("✅ Download complete, opening file...");

      try {
        // Try to open with FileViewer
        await FileViewer.open(localPath, {});
      } catch (fileViewerError: any) {
        console.error("FileViewer error:", fileViewerError);

        // If FileViewer fails, try using Linking API
        if (Platform.OS === 'android') {
          const { Linking } = require('react-native');

          // For Android, convert file path to file:// URI
          const fileUri = `file://${localPath}`;

          try {
            const canOpen = await Linking.canOpenURL(fileUri);
            if (canOpen) {
              await Linking.openURL(fileUri);
            } else {
              // Show options to user
              Alert.alert(
                "File Downloaded",
                `The file has been saved to:\n${localPath}\n\nYou may need to install a PDF viewer app from the Play Store.`,
                [
                  {
                    text: "Open Play Store",
                    onPress: () => {
                      Linking.openURL('market://details?id=com.adobe.reader');
                    }
                  },
                  {
                    text: "OK",
                    style: "cancel"
                  }
                ]
              );
            }
          } catch (linkingError) {
            Alert.alert(
              "File Downloaded",
              `File saved successfully at:\n${localPath}\n\nPlease install a PDF viewer to open this file.`,
              [
                {
                  text: "OK",
                  style: "cancel"
                }
              ]
            );
          }
        } else {
          throw fileViewerError;
        }
      }

    } catch (err) {
      console.error('openDocument error:', err);
      Alert.alert(
        "Error",
        "Failed to open document. Please ensure you have a PDF viewer app installed.",
        [
          {
            text: "Install PDF Viewer",
            onPress: () => {
              const { Linking } = require('react-native');
              Linking.openURL('market://details?id=com.adobe.reader');
            }
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
    }
  };

  // -------------------------
  // PIN helpers
  // -------------------------
  const savePinnedToStorage = async (chatId: string, messageId: string | null) => {
    try {
      if (!messageId) {
        await AsyncStorage.removeItem(PIN_STORAGE_KEY(chatId));
      } else {
        await AsyncStorage.setItem(PIN_STORAGE_KEY(chatId), String(messageId));
      }
    } catch (e) {
      console.warn("Failed to persist pin:", e);
    }
  };

  const pinMessage = async (msg: MessageType) => {
    try {
      await savePinnedToStorage(chatPartnerId, msg._id || null);
      setPinnedMessage(msg);
      setLongPressMenuVisible(false);
      Alert.alert("Pinned", "Message pinned.");
    } catch (e) {
      console.warn("Pin failed:", e);
      Alert.alert("Error", "Failed to pin message");
    }
  };

  const unpinMessage = async () => {
    try {
      await savePinnedToStorage(chatPartnerId, null);
      setPinnedMessage(null);
      setLongPressMenuVisible(false);
      Alert.alert("Unpinned", "Message unpinned.");
    } catch (e) {
      console.warn("Unpin failed:", e);
      Alert.alert("Error", "Failed to unpin message");
    }
  };

  const scrollToPinned = () => {
    if (!pinnedMessage || !pinnedMessage._id) {
      Alert.alert("No pinned message");
      return;
    }
    const idx = messages.findIndex((m) => String(m._id) === String(pinnedMessage._id));
    if (idx === -1) {
      Alert.alert("Pinned message not found in this chat");
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.2 });
  };

  const copyMessageText = (msg: MessageType) => {
    try {
      if (!msg.text) {
        Alert.alert("Nothing to copy");
        return;
      }
      Clipboard.setString(msg.text);
      setLongPressMenuVisible(false);
      Alert.alert("Copied", "Message copied to clipboard.");
    } catch (e) {
      console.warn("Copy failed:", e);
      Alert.alert("Error", "Copy failed");
    }
  };

 const handleDeleteMessage = async (msg: MessageType) => {
  if (!msg._id) return;

  const messageId = msg._id;
  const isMine = String(msg.senderId) === String(userId);

  setLongPressMenuVisible(false);

  // Delete for me (immediate UI update)
  setMessages(prev => prev.filter(m => m._id !== messageId));

  // Unpin if needed
  if (pinnedMessage && String(pinnedMessage._id) === messageId) {
    await savePinnedToStorage(chatPartnerId, null);
    setPinnedMessage(null);
  }

  try {
    await deleteMessageForMe(messageId);
  } catch (e) {
    console.warn("Delete for me failed", e);
  }

  // Delete for everyone (only sender)
  if (isMine) {
    try {
      await deleteMessageForEveryone(messageId);

      setMessages(prev =>
        prev.map(m =>
          m._id === messageId
            ? {
                ...m,
                isDeletedForEveryone: true,
                text: null,
                image: null,
                document: null,
              }
            : m
        )
      );

      emitDeleteForEveryone(messageId, chatPartnerId);
    } catch (e) {
      console.warn("Delete for everyone failed", e);
    }
  }
};

  // -------------------------
  // Send message
  // -------------------------
  const sendAll = async () => {
    if (isBlocked) {
      Alert.alert("Blocked", "You cannot send messages to this user");
      return;
    }
    if (!message.trim() && selectedImages.length === 0 && selectedDocuments.length === 0) return;
    if (sending) return;

    setSending(true);

    try {
      const uploadImageOnly = async (img: SelectedImage): Promise<MessageType> => {
        const form = new FormData();
        form.append("file", {
          uri: img.uri,
          name: img.name || "photo.jpg",
          type: img.type || "image/jpeg",
        } as any);
        const r = await api.post(`/api/messages/send/${chatPartnerId}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return r.data as MessageType;
      };

      const uploadDocumentOnly = async (doc: SelectedDocument): Promise<MessageType> => {
        const form = new FormData();
        form.append("file", {
          uri: doc.uri,
          name: doc.name,
          type: doc.type || "application/octet-stream",
        } as any);
        const r = await api.post(`/api/messages/send/${chatPartnerId}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return r.data as MessageType;
      };

      // Send text message first if exists
      if (message.trim()) {
        const form = new FormData();
        form.append("text", message.trim());

        if (selectedImages.length > 0) {
          const first = selectedImages[0];
          form.append("file", {
            uri: first.uri,
            name: first.name || "photo.jpg",
            type: first.type || "image/jpeg",
          } as any);
        } else if (selectedDocuments.length > 0) {
          const first = selectedDocuments[0];
          form.append("file", {
            uri: first.uri,
            name: first.name,
            type: first.type || "application/octet-stream",
          } as any);
        }

        const res = await api.post(`/api/messages/send/${chatPartnerId}`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const firstMsg = res.data as MessageType;
        const msgWithStatus: MessageType = { ...firstMsg, status: "sent" };
        pushMessage(msgWithStatus);
        socket?.emit("sendMessage", msgWithStatus);
      }

      // Send remaining images
      const imageStartIndex = message.trim() && selectedImages.length > 0 ? 1 : 0;
      for (let i = imageStartIndex; i < selectedImages.length; i++) {
        try {
          const imgMsg = await uploadImageOnly(selectedImages[i]);
          const imgMsgWithStatus: MessageType = { ...imgMsg, status: "sent" };
          pushMessage(imgMsgWithStatus);
          socket?.emit("sendMessage", imgMsgWithStatus);
        } catch (e) {
          console.warn("upload image failed:", e);
        }
      }

      // Send remaining documents
      const docStartIndex =
        message.trim() && selectedImages.length === 0 && selectedDocuments.length > 0 ? 1 : 0;
      for (let i = docStartIndex; i < selectedDocuments.length; i++) {
        try {
          const docMsg = await uploadDocumentOnly(selectedDocuments[i]);
          const docMsgWithStatus: MessageType = { ...docMsg, status: "sent" };
          pushMessage(docMsgWithStatus);
          socket?.emit("sendMessage", docMsgWithStatus);
        } catch (e) {
          console.warn("upload document failed:", e);
        }
      }

      setMessage("");
      setSelectedImages([]);
      setSelectedDocuments([]);
      setViewerVisible(false);
      setViewingSentImage(false);

      if (emitTyping) emitTyping(chatPartnerId, false);

      // Multiple scroll attempts to ensure latest message is visible
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 400);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 600);
    } catch (err: any) {
      console.warn("send failed", err);
      if (err.response?.status === 404)
        Alert.alert("Error", "User not found or chat not available");
      else Alert.alert("Error", "Failed to send messages");
    } finally {
      setSending(false);
    }
  };

  // -------------------------
  // Date separator helpers
  // -------------------------
  function isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  function isYesterday(date: Date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return isSameDay(date, yesterday);
  }

  function formatSeparatorLabel(dateStr?: string) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isSameDay(d, new Date())) return "Today";
      if (isYesterday(d)) return "Yesterday";
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 7) {
        return d.toLocaleDateString(undefined, { weekday: "long" });
      }
      return d.toLocaleDateString();
    } catch (e) {
      return "";
    }
  }

  // -------------------------
  // SEARCH: local debounced + build matchIndexes
  // -------------------------
  useEffect(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }

    if (!searchQuery.trim()) {
      setFilteredMessages(null);
      setSearching(false);
      setMatchIndexes([]);
      setCurrentMatchIdx(0);
      return;
    }

    setSearching(true);

    searchTimer.current = setTimeout(() => {
      const q = searchQuery.trim().toLowerCase();
      const local = messages.filter((m) => (m.text || "").toLowerCase().includes(q));
      setFilteredMessages(local);
      setSearching(false);

      const idxs: number[] = [];
      for (let i = 0; i < local.length; i++) {
        // local is already filtered, so all indices are valid
        idxs.push(i);
      }
      setMatchIndexes(idxs);
      setCurrentMatchIdx(0);

      // if (idxs.length > 0) {
      //   setTimeout(() => {
      //     flatListRef.current?.scrollToIndex({ index: idxs[idxs.length - 1], animated: true, viewPosition: 0.5 });
      //   }, 120);
      // } else {
      //   setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
      // }
    }, 300);

    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
        searchTimer.current = null;
      }
    };
  }, [searchQuery, messages]);

  const goPrevMatch = () => {
    if (matchIndexes.length === 0 || !filteredMessages) return;
    const nextIdx = Math.max(0, currentMatchIdx - 1);
    setCurrentMatchIdx(nextIdx);
    // Scroll in the search modal should use filteredMessages indices
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    flatListRef.current?.scrollToIndex({
      index: nextIdx,  // Use nextIdx directly since it maps to filteredMessages
      animated: true,
      viewPosition: 0.5
    });
  };

  const goNextMatch = () => {
    if (matchIndexes.length === 0 || !filteredMessages) return;
    const nextIdx = Math.min(matchIndexes.length - 1, currentMatchIdx + 1);
    setCurrentMatchIdx(nextIdx);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    flatListRef.current?.scrollToIndex({
      index: nextIdx,  // Use nextIdx directly since it maps to filteredMessages
      animated: true,
      viewPosition: 0.5
    });
  };

  const renderHighlightedText = (text: string | undefined, messageIndex?: number) => {
    if (!text) return null;
    if (!searchQuery.trim()) return <Text style={styles.theirMessageText}>{text}</Text>;

    const q = searchQuery.trim().toLowerCase();
    const lower = text.toLowerCase();

    const parts: any[] = [];
    let lastIndex = 0;
    let idx = lower.indexOf(q, lastIndex);
    while (idx !== -1) {
      const before = text.substring(lastIndex, idx);
      const match = text.substring(idx, idx + q.length);
      if (before) parts.push({ text: before, match: false });
      parts.push({ text: match, match: true });
      lastIndex = idx + q.length;
      idx = lower.indexOf(q, lastIndex);
    }
    if (lastIndex < text.length) parts.push({ text: text.substring(lastIndex), match: false });

    return (
      <Text style={styles.theirMessageText}>
        {parts.map((p, i) =>
          p.match ? (
            <Text
              key={i}
              style={[
                styles.searchHighlight,
                matchIndexes.length > 0 && matchIndexes[currentMatchIdx] === messageIndex ? { backgroundColor: "#ffd54f" } : {},
              ]}
            >
              {p.text}
            </Text>
          ) : (
            <Text key={i}>{p.text}</Text>
          )
        )}
      </Text>
    );
  };

  const renderSelectedThumb = ({ item, index }: { item: SelectedImage; index: number }) => {
    const isVideo = isVideoFile(item.uri, item.type);

    return (
      <View style={styles.thumbBox}>
        <TouchableOpacity
          onPress={() => {
            setViewerIndex(index);
            setViewingSentImage(false);
            setViewerVisible(true);
          }}
        >
          {isVideo ? (
            <View style={styles.videoThumbContainer}>
              <Video
                source={{ uri: item.uri }}
                style={styles.thumb}
                paused={true}
                resizeMode="cover"
              />
              <View style={styles.videoThumbOverlay}>
                <Text style={styles.videoThumbIcon}>▶️ </Text>
              </View>
            </View>
          ) : (
            <Image source={{ uri: item.uri }} style={styles.thumb} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.thumbRemove} onPress={() => removeSelectedImage(index)}>
          <Text style={styles.thumbRemoveText}>×</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSelectedDoc = ({ item, index }: { item: SelectedDocument; index: number }) => (
    <View style={styles.docBox}>
      <View style={styles.docInfo}>
        <Text style={styles.docIcon}>{getDocumentIcon(item.type)}</Text>
        <View style={styles.docTextContainer}>
          <Text style={styles.docName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.docSize}>{formatFileSize(item.size)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.docRemove} onPress={() => removeSelectedDocument(index)}>
        <Text style={styles.docRemoveText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  const getMessageKey = (item: MessageType, index: number) => {
    return item._id ? item._id : `msg-${index}-${Date.now()}`;
  };

  const showing = filteredMessages !== null ? filteredMessages : messages;

  // -------------------------
  // RENDER MESSAGE - CRITICAL FIX FOR ALIGNMENT
  // -------------------------
  const renderMessage = ({ item, index }: { item: MessageType; index: number }) => {
    const currentDate = item?.createdAt ? new Date(item.createdAt) : null;

    // ---------- DATE SEPARATOR LOGIC ----------
    let showSeparator = false;
    let separatorLabel = "";

    try {
      const prev = index > 0 ? showing[index - 1] : null;
      const prevDate = prev?.createdAt ? new Date(prev.createdAt) : null;

      if (!prevDate || !currentDate || !isSameDay(currentDate, prevDate)) {
        showSeparator = true;
        separatorLabel = currentDate ? formatSeparatorLabel(item.createdAt) : "";
      }
    } catch {
      showSeparator = false;
    }

    // ---------- OWN MESSAGE CHECK ----------
    // CRITICAL: Compare senderId with MY userId (not chatPartnerId)
    const isMine = String(item.senderId) === String(userId);

    // ---------- FILE HANDLING ----------
    const fileUrlRaw = item.image || item.document || null;
    const fileUrl = normalizeFileUrl(fileUrlRaw);
    const isImageOrVideo = looksLikeImageOrVideo(fileUrl || undefined);
    const isVideo = fileUrl ? isVideoFile(fileUrl) : false;

    // ---------- STATUS TICKS (WhatsApp Style) ----------
    const renderStatusTicks = () => {
      // Only show ticks for MY messages
      if (!isMine) return null;

      const status = item.status || "sent";

      return (
        <View style={styles.tickContainer}>
          {status === "sent" && (
            <Text style={[styles.tickText, styles.singleTick]}>✓</Text>
          )}
          {status === "delivered" && (
            <Text style={[styles.tickText, styles.doubleTick]}>✓✓</Text>
          )}
          {status === "read" && (
            <Text style={[styles.tickText, styles.readTick]}>✓✓</Text>
          )}
        </View>
      );
    };

    const isThisPinned =
      pinnedMessage && item._id && String(item._id) === String(pinnedMessage._id);

    // ---------- RENDER ----------
    return (
      <>
        {/* DATE SEPARATOR */}
        {showSeparator && (
          <View style={styles.dateSeparatorWrap}>
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>{separatorLabel}</Text>
            </View>
          </View>
        )}

        {/* MESSAGE WRAPPER - ALIGNMENT BASED ON isMine */}
        <View
          style={[
            styles.messageWrapper,
            isMine ? styles.myMessageWrapper : styles.theirMessageWrapper,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => {
              setLongPressTarget(item);
              setLongPressMenuVisible(true);
            }}
            style={[
              styles.messageBubble,
              isMine ? styles.myBubble : styles.theirBubble,
            ]}
          >
            {/* IMAGE / VIDEO */}
            {fileUrl && isImageOrVideo && (
              <TouchableOpacity onPress={() => openSentImageViewer(fileUrl)}>
                {isVideo ? (
                  <View style={styles.videoContainer}>
                    <Video
                      source={{ uri: fileUrl }}
                      style={styles.messageImage}
                      paused
                      resizeMode="cover"
                    />
                    <View style={styles.videoOverlayCenter}>
                      <Text style={styles.playIcon}>▶</Text>
                    </View>
                  </View>
                ) : (
                  <Image
                    source={{ uri: fileUrl }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                )}
              </TouchableOpacity>
            )}

            {/* DOCUMENT */}
            {fileUrl && !isImageOrVideo && (
              <TouchableOpacity
                style={[
                  styles.messageDocumentContainer,
                  isMine
                    ? styles.messageDocumentContainerMy
                    : styles.messageDocumentContainerTheir,
                ]}
                onPress={() => {
                  const docName =
                    item.documentName || filenameFromUrl(fileUrl) || "document.file";
                  openDocument(fileUrl, docName);
                }}
              >
                <Text style={styles.messageDocIcon}>
                  {getDocumentIcon(item.documentType || filenameFromUrl(fileUrl))}
                </Text>

                <View style={styles.messageDocInfo}>
                  <Text
                    style={[
                      styles.messageDocName,
                      isMine && { color: "#1f2937" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.documentName || filenameFromUrl(fileUrl)}
                  </Text>
                  <Text
                    style={[
                      styles.messageDocSize,
                      isMine && { color: "#6b7280" },
                    ]}
                  >
                    {item.documentSize
                      ? formatFileSize(item.documentSize)
                      : "File"}
                  </Text>
                </View>

                <Text style={{ fontSize: 22, marginLeft: 10 }}>⬇️ </Text>
              </TouchableOpacity>
            )}

            {/* TEXT MESSAGE */}
           {/* DELETED MESSAGE (WHATSAPP STYLE) */}
{item.isDeletedForEveryone ? (
  <View style={{ marginBottom: 2 }}>
    <Text
      style={[
        styles.deletedMessageText,
        isMine ? styles.deletedMine : styles.deletedTheirs,
      ]}
    >
      🚫 This message was deleted
    </Text>
  </View>
) : (
  item.text && (
    <View style={{ marginBottom: 2 }}>
      {isMine ? (
        <Text style={styles.myMessageText}>{item.text}</Text>
      ) : (
        renderHighlightedText(item.text, index)
      )}
    </View>
  )
)}


            {/* FOOTER: TIME + PIN + STATUS TICKS (WhatsApp style - inline with text) */}
            <View style={styles.messageFooter}>
              {isThisPinned && (
                <Text
                  style={{
                    fontSize: 12,
                    marginRight: 4,
                    color: isMine ? "rgba(255,255,255,0.7)" : "#6b7280",
                  }}
                >
                  📌
                </Text>
              )}

              <Text
                style={[
                  styles.timeText,
                  isMine ? styles.myTimeText : styles.theirTimeText,
                ]}
              >
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : ""}
              </Text>

              {renderStatusTicks()}
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  };


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

const handleClearChat = () => {
  setMenuVisible(false);

  Alert.alert(
    "Clear chat",
    "This will delete all messages in this chat only for you.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            // Clear UI immediately
            setMessages([]);
            setFilteredMessages(null);

            // Save cleared time locally
            await AsyncStorage.setItem(
              `clearedAt:${chatPartnerId}`,
              new Date().toISOString()
            );

            // Remove pinned message
            await AsyncStorage.removeItem(PIN_STORAGE_KEY(chatPartnerId));
            setPinnedMessage(null);

            // Call backend
            await clearChatApi(chatPartnerId);

            Alert.alert("Chat cleared");
          } catch (e) {
            console.warn("Clear chat failed", e);
            Alert.alert("Chat cleared locally", "Messages cleared for you, but backend may still have them.");
          }
        },
      },
    ]
  );
};


  const handleReportUser = () => {
    setMenuVisible(false);
    Alert.alert("Report user", "Report functionality will be implemented later.");
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flex: 1, marginHorizontal: 8 }}
                onPress={() => {
                  console.log("Profile navigation disabled");
                }}
              >
                <Text style={styles.headerName}>{name}</Text>
                <Text style={styles.chatStatusSmall}>
                  {partnerTyping ? "typing..." : partnerOnline ? "Online" : "Offline"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.searchIconBtn}>
                <Text style={styles.searchIcon}>⋮</Text>
              </TouchableOpacity>
            </View>

            {pinnedMessage && (
              <TouchableOpacity
                style={{
                  backgroundColor: "#f3f9f3",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginHorizontal: 12,
                  marginTop: 12,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: "#d1f0d1",
                }}
                onPress={() => scrollToPinned()}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Text style={{ marginRight: 10 }}>📌</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontWeight: "700", color: "#064e12" }}>
                      {String(pinnedMessage.senderId) === String(userId) ? "You: " : ""}
                      {(pinnedMessage.text || "").length > 60 ? (pinnedMessage.text || "").slice(0, 60) + "..." : pinnedMessage.text}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#3b7a3b" }}>{pinnedMessage.createdAt ? new Date(pinnedMessage.createdAt).toLocaleString() : ""}</Text>
                  </View>
                </View>

                <TouchableOpacity onPress={() => unpinMessage()} style={{ marginLeft: 12 }}>
                  <Text style={{ color: "#064e12", fontWeight: "700" }}>Unpin</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}

            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
              <TouchableOpacity style={menuStyles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                <View style={menuStyles.menu}>
                  <TouchableOpacity style={menuStyles.menuItem} onPress={() => { setMenuVisible(false); setSearchModalVisible(true); }}>
                    <Text style={menuStyles.menuText}>Search chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={menuStyles.menuItem} onPress={handleClearChat}>
                    <Text style={menuStyles.menuText}>Clear chat</Text>
                  </TouchableOpacity>

                  {/* CHANGED: Show Unblock if blocked, Block if not blocked */}
                  {isBlocked ? (
                    <TouchableOpacity
                      style={menuStyles.menuItem}
                      onPress={() => {
                        setMenuVisible(false);
                        Alert.alert(
                          "Unblock User",
                          `Are you sure you want to unblock ${name}?`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Unblock",
                              style: "default",
                              onPress: handleUnblockUser
                            }
                          ]
                        );
                      }}
                    >
                      <Text style={menuStyles.menuText}>Unblock {name}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={menuStyles.menuItem} onPress={() => { setMenuVisible(false); setShowBlockModal(true); }}>
                      <Text style={menuStyles.menuText}>Block {name}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={menuStyles.menuItem} onPress={handleReportUser}>
                    <Text style={menuStyles.menuText}>Report {name}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>

            <Modal visible={searchModalVisible} animationType="slide" transparent>
              <SafeAreaView style={searchModalStyles.modal}>
                <View style={searchModalStyles.header}>
                  <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={searchModalStyles.closeBtn}>
                    <Text style={searchModalStyles.closeText}>Back</Text>
                  </TouchableOpacity>

                  <TextInput
                    placeholder="Search messages..."
                    placeholderTextColor="#9ca3af"
                    value={searchQuery}
                    onChangeText={(t) => setSearchQuery(t)}
                    style={searchModalStyles.input}
                    autoFocus
                  />

                  {searchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => setSearchQuery("")} style={searchModalStyles.clearBtn}>
                      <Text style={searchModalStyles.clearText}>✖</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <View style={searchModalStyles.resultInfo}>
                  <Text style={searchModalStyles.resultText}>{searching ? "Searching..." : `${matchIndexes.length} match${matchIndexes.length === 1 ? "" : "es"}`}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 12 }}>
                    <TouchableOpacity onPress={goPrevMatch} disabled={matchIndexes.length === 0} style={{ padding: 8, marginRight: 6 }}>
                      <Text style={{ color: matchIndexes.length === 0 ? "#ccc" : COLORS.primary }}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={goNextMatch} disabled={matchIndexes.length === 0} style={{ padding: 8 }}>
                      <Text style={{ color: matchIndexes.length === 0 ? "#ccc" : COLORS.primary }}>↓</Text>
                    </TouchableOpacity>
                    <Text style={{ marginLeft: 8, color: "#374151", fontWeight: "600" }}>{matchIndexes.length > 0 ? `${currentMatchIdx + 1} / ${matchIndexes.length}` : ""}</Text>
                  </View>
                </View>

                <FlatList
                  ref={flatListRef}
                  data={showing}
                  keyboardShouldPersistTaps="handled"
                  renderItem={renderMessage}
                  keyExtractor={getMessageKey}
                  contentContainerStyle={[
                    styles.messagesContainer,
                    {
                      paddingBottom: insets.bottom + 90, // Use insets.bottom for proper spacing
                      flexGrow: 1,
                    },
                  ]}

                  onContentSizeChange={() => {
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                  onLayout={() => {
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    }, 50);
                  }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>{searchQuery ? "No matches found" : "No messages yet"}</Text>
                      <Text style={styles.emptySubtext}>{searchQuery ? "Try another keyword." : "Start a conversation by sending a message!"}</Text>
                    </View>
                  }
                />
              </SafeAreaView>
            </Modal>

            <Modal
              visible={longPressMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setLongPressMenuVisible(false)}
            >
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }}
                activeOpacity={1}
                onPress={() => setLongPressMenuVisible(false)}
              >
                <View
                  style={{
                    position: "absolute",
                    bottom: Platform.OS === "ios" ? 140 : 120,
                    left: 40,
                    right: 40,
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    elevation: 10,
                  }}
                >
                  {/* PIN / UNPIN */}
                  <TouchableOpacity
                    style={{ paddingVertical: 12 }}
                    onPress={() => {
                      if (!longPressTarget) return;
                      const alreadyPinned =
                        pinnedMessage &&
                        longPressTarget._id &&
                        String(longPressTarget._id) === String(pinnedMessage._id);

                      if (alreadyPinned) unpinMessage();
                      else pinMessage(longPressTarget);
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600" }}>
                      {pinnedMessage &&
                        longPressTarget &&
                        longPressTarget._id &&
                        String(longPressTarget._id) === String(pinnedMessage._id)
                        ? "Unpin"
                        : "Pin"}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: "#eee" }} />

                  {/* COPY */}
                  <TouchableOpacity
                    style={{ paddingVertical: 12 }}
                    onPress={() => {
                      if (!longPressTarget) return;
                      copyMessageText(longPressTarget);
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600" }}>Copy</Text>
                  </TouchableOpacity>

                  {/* DELETE OPTIONS */}
{longPressTarget && (
  <>
    <View style={{ height: 1, backgroundColor: "#eee" }} />

    {/* DELETE FOR ME */}
    <TouchableOpacity
      style={{ paddingVertical: 12 }}
      onPress={async () => {
        await deleteMessageForMe(longPressTarget._id!);

        setMessages(prev =>
          prev.filter(m => m._id !== longPressTarget._id)
        );

        setLongPressMenuVisible(false);
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "600" }}>
        Delete for me
      </Text>
    </TouchableOpacity>

    {/* DELETE FOR EVERYONE – ONLY IF I AM SENDER */}
  <>
  <View style={{ height: 1, backgroundColor: "#eee" }} />

  <TouchableOpacity
    style={{ paddingVertical: 12 }}
    onPress={async () => {
     try {
  await deleteMessageForEveryone(longPressTarget._id!);

  setMessages(prev =>
    prev.map(m =>
      m._id === longPressTarget._id
        ? {
            ...m,
            isDeletedForEveryone: true,
            text: null,
            image: null,
            document: null,
          }
        : m
    )
  );

  emitDeleteForEveryone(longPressTarget._id!, chatPartnerId);
} catch (e: any) {
  Alert.alert(
    "Cannot delete message",
    "You can’t delete this message for everyone anymore."
  );
} finally {
  setLongPressMenuVisible(false);
}

    }}
  >
    <Text style={{ fontSize: 16, fontWeight: "600", color: "#ef4444" }}>
      Delete for everyone
    </Text>
  </TouchableOpacity>
</>

    
  </>
)}


                </View>
              </TouchableOpacity>
            </Modal>

            {(isBlocked || isBlockedByThem) && (
              <View style={styles.blockedOverlay}>
                <View style={styles.blockedCard}>
                  <Text style={styles.blockedCardText}>
                    {isBlocked ? "You blocked this contact" : "You cannot message this user"}
                  </Text>

                  {isBlocked && (
                    <TouchableOpacity
                      style={styles.tapToUnblockButton}
                      onPress={handleUnblockUser}
                      disabled={blockLoading}
                    >
                      {blockLoading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} />
                      ) : (
                        <Text style={styles.tapToUnblockText}>Tap to unblock</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {!searchModalVisible && (
              <FlatList
                ref={flatListRef}
                data={showing}
                keyboardShouldPersistTaps="handled"
                renderItem={renderMessage}
                keyExtractor={getMessageKey}
                contentContainerStyle={[
                  styles.messagesContainer,
                  {
                    paddingBottom: isKeyboardVisible
                      ? (keyboardHeight + 100)
                      : (insets.bottom + 90),
                    flexGrow: 1,
                  },
                ]}
                onContentSizeChange={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                onLayout={() => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }, 50);
                }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>{searchQuery ? "No matches found" : "No messages yet"}</Text>
                    <Text style={styles.emptySubtext}>{searchQuery ? "Try another keyword." : "Start a conversation by sending a message!"}</Text>
                  </View>
                }
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                      index: Math.max(0, Math.min(info.index, (showing?.length || 1) - 1)),
                      animated: true
                    });
                  }, 120);
                }}
              />
            )}

            <Modal visible={showAttachmentModal} transparent animationType="fade" onRequestClose={() => setShowAttachmentModal(false)}>
              <TouchableOpacity style={attachmentModalStyles.overlay} activeOpacity={1} onPress={() => setShowAttachmentModal(false)}>
                <View style={attachmentModalStyles.menu}>
                  <TouchableOpacity
                    style={attachmentModalStyles.menuItem}
                    onPress={() => {
                      setShowAttachmentModal(false);
                      pickDocuments();
                    }}
                  >
                    <Text style={attachmentModalStyles.menuIcon}>📎</Text>
                    <Text style={attachmentModalStyles.menuText}>Document</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={attachmentModalStyles.menuItem}
                    onPress={() => {
                      pickImages();
                    }}
                  >
                    <Text style={attachmentModalStyles.menuIcon}>🖼️ </Text>
                    <Text style={attachmentModalStyles.menuText}>Photo</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>

            {!isBlocked && !isBlockedByThem && (
              <View style={{ backgroundColor: '#fff' }}>
                {selectedImages.length > 0 && (
                  <View style={styles.selectedBar}>
                    <FlatList
                      horizontal
                      data={selectedImages}
                      renderItem={renderSelectedThumb}
                      keyExtractor={(_, i) => `sel-${i}`}
                      showsHorizontalScrollIndicator={false}
                    />
                    <TouchableOpacity style={styles.sendSelectedBtn} onPress={sendAll} disabled={sending}>
                      <Text style={styles.sendSelectedText}>
                        {sending ? "Sending..." : `Send (${selectedImages.length})`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedDocuments.length > 0 && (
                  <View style={styles.selectedDocsBar}>
                    <FlatList
                      data={selectedDocuments}
                      renderItem={renderSelectedDoc}
                      keyExtractor={(_, i) => `doc-${i}`}
                      showsVerticalScrollIndicator={false}
                      style={{ maxHeight: 200 }}
                    />
                    <TouchableOpacity style={styles.sendSelectedBtn} onPress={sendAll} disabled={sending}>
                      <Text style={styles.sendSelectedText}>
                        {sending ? "Sending..." : `Send (${selectedDocuments.length})`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View
                  style={[
                    styles.inputContainer,
                    {
                      paddingBottom: isKeyboardVisible ? 12 : (Platform.OS === 'android' ? insets.bottom : 12),
                    }
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setShowAttachmentModal(true)}
                    style={styles.mediaButton}
                  >
                    <Text style={styles.mediaButtonText}>📎</Text>
                  </TouchableOpacity>

                  <TextInput
                    placeholder="Type a message..."
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    value={message}
                    onChangeText={(t) => {
                      setMessage(t);
                      if (emitTyping) emitTyping(chatPartnerId, t.length > 0);
                    }}
                    multiline
                    editable={!sending}
                  />

                  <TouchableOpacity
                    style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                    onPress={sendAll}
                    disabled={sending || (!message.trim() && selectedImages.length === 0 && selectedDocuments.length === 0)}
                  >
                    <Text style={styles.sendText}>{sending ? "..." : "↑"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Modal visible={showBlockModal} transparent animationType="fade">
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Block User</Text>
                  <Text style={styles.modalMessage}>Are you sure you want to block {name}? You will not be able to send or receive messages from them.</Text>
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowBlockModal(false)}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalButton, styles.blockConfirmButton]} onPress={handleBlockUser} disabled={blockLoading}>
                      {blockLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.blockConfirmText}>Block</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={viewerVisible} animationType="slide" onRequestClose={closeViewer}>
              <SafeAreaView style={viewerStyles.modal}>
                <View style={viewerStyles.header}>
                  <TouchableOpacity onPress={closeViewer} style={viewerStyles.closeButton}>
                    <Text style={viewerStyles.closeText}>Close</Text>
                  </TouchableOpacity>
                  <Text style={viewerStyles.counter}>{viewerIndex + 1}/{selectedImages.length || 1}</Text>
                </View>

                <View style={viewerStyles.content}>
                  {selectedImages[viewerIndex] ? (
                    isVideoFile(selectedImages[viewerIndex].uri, selectedImages[viewerIndex].type) ? (
                      <Video
                        source={{ uri: selectedImages[viewerIndex].uri }}
                        style={viewerStyles.fullVideo}
                        controls={true}
                        resizeMode="contain"
                        paused={false}
                        repeat={false}
                      />
                    ) : (
                      <ScrollView
                        style={viewerStyles.scrollView}
                        contentContainerStyle={viewerStyles.scrollContent}
                        maximumZoomScale={Platform.OS === "ios" ? 3 : 1.5}
                        minimumZoomScale={1}
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                      >
                        <Image
                          source={{ uri: selectedImages[viewerIndex].uri }}
                          style={viewerStyles.fullImage}
                          resizeMode="contain"
                        />
                      </ScrollView>
                    )
                  ) : (
                    <Text style={viewerStyles.noImageText}>No media</Text>
                  )}
                </View>

                {!viewingSentImage && selectedImages.length > 1 && (
                  <View style={viewerStyles.navigation}>
                    <TouchableOpacity
                      disabled={viewerIndex <= 0}
                      onPress={() => setViewerIndex((p) => Math.max(0, p - 1))}
                      style={viewerStyles.navButton}
                    >
                      <Text style={[viewerStyles.navText, viewerIndex <= 0 && viewerStyles.navDisabled]}>
                        Previous
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={viewerIndex >= selectedImages.length - 1}
                      onPress={() => setViewerIndex((p) => Math.min(selectedImages.length - 1, p + 1))}
                      style={viewerStyles.navButton}
                    >
                      <Text style={[viewerStyles.navText, viewerIndex >= selectedImages.length - 1 && viewerStyles.navDisabled]}>
                        Next
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </SafeAreaView>
            </Modal>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#6b7280", fontWeight: "500" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 80 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6b7280", marginBottom: 6 },
  emptySubtext: { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === "ios" ? 50 : StatusBar.currentHeight || 35, // RESET TO ORIGINAL
    paddingBottom: 10, // RESET TO ORIGINAL
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  backButton: { padding: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 18, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  backButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "left" },
  chatStatusSmall: { color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 2 },
  searchIconBtn: { marginRight: 4, padding: 6, borderRadius: 18 },
  searchIcon: { fontSize: 18, color: "#fff" },
  searchHighlight: { backgroundColor: "#fff59b", color: "#111827", fontWeight: "700" },
  messagesContainer: {
    padding: 12,
    paddingBottom: 20, // Will be overridden dynamically
    flexGrow: 1
  },
  messageWrapper: { marginVertical: 4 },
  myMessageWrapper: { alignItems: "flex-end" },
  theirMessageWrapper: { alignItems: "flex-start" },
  messageBubble: { padding: 10, borderRadius: 16, maxWidth: "80%", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  myBubble: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  myMessageText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 19,
    paddingBottom: 2,
  },
  theirMessageText: {
    color: "#1f2937",
    fontSize: 14,
    lineHeight: 19,
    paddingBottom: 2,
  },
  messageImage: { width: 180, height: 180, borderRadius: 10, marginBottom: 6 },
  messageDocIcon: { fontSize: 28, marginRight: 10 },
  messageDocInfo: { flex: 1 },
  messageDocName: { fontSize: 13, fontWeight: "600", color: "#1f2937", marginBottom: 3 },
  messageDocSize: { fontSize: 11, color: "#6b7280" },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 2,
    alignSelf: "flex-end",
  },
  timeText: {
    fontSize: 10,
    fontWeight: "500",
  },
  myTimeText: {
    color: "rgba(255,255,255,0.7)",
  },
  theirTimeText: {
    color: "#6b7280",
  },
  tickContainer: {
    marginLeft: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  tickText: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 13,
  },
  singleTick: {
    color: "rgba(255,255,255,0.7)",
  },
  doubleTick: {
    color: "rgba(255,255,255,0.7)",
  },
  readTick: {
    color: "#4FC3F7",
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 5,
  },
  mediaButton: { padding: 6, marginRight: 6, backgroundColor: "#f3f4f6", borderRadius: 18, width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  mediaButtonText: { fontSize: 16 },
  input: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 6, fontSize: 15, maxHeight: 90, borderWidth: 1, borderColor: "#e5e7eb" },
  sendButton: { backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginLeft: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 2 },
  sendButtonDisabled: { opacity: 0.6 },
  sendText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  selectedBar: { flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  selectedDocsBar: { padding: 12, borderTopWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb" },
  thumbBox: { marginRight: 10, position: "relative" },
  thumb: { width: 55, height: 55, borderRadius: 8 },
  thumbRemove: { position: "absolute", top: -5, right: -5, backgroundColor: "#ef4444", width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 2 },
  thumbRemoveText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  docBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", padding: 10, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: "#e5e7eb" },
  docInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  docIcon: { fontSize: 24, marginRight: 10 },
  docTextContainer: { flex: 1 },
  docName: { fontSize: 13, fontWeight: "600", color: "#1f2937", marginBottom: 3 },
  docSize: { fontSize: 11, color: "#6b7280" },
  docRemove: { backgroundColor: "#ef4444", width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", marginLeft: 10 },
  docRemoveText: { color: "#fff", fontSize: 13, fontWeight: "bold" },
  sendSelectedBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, marginTop: 8, alignSelf: "center", shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 2 },
  sendSelectedText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: "#fff", borderRadius: 18, padding: 20, width: "100%", maxWidth: 320, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 6, textAlign: "center" },
  modalMessage: { fontSize: 15, color: "#6b7280", textAlign: "center", lineHeight: 21, marginBottom: 20 },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  cancelButton: { backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  cancelButtonText: { color: "#374151", fontSize: 15, fontWeight: "600" },
  blockConfirmButton: { backgroundColor: "#ef4444" },
  blockConfirmText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  dateSeparatorWrap: { alignItems: "center", marginVertical: 6 },
  dateSeparator: { backgroundColor: "rgba(0,0,0,0.06)", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 14 },
  dateSeparatorText: { color: "#374151", fontSize: 11, fontWeight: "600" },
  videoOverlay: { justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
  playIcon: { fontSize: 36, color: "rgba(255,255,255,0.9)", position: "absolute" },
  messageDocumentContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
    minWidth: 180,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  messageDocumentContainerMy: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderColor: "rgba(255,255,255,0.4)",
  },
  messageDocumentContainerTheir: {
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
  },
  videoThumbContainer: {
    width: 55,
    height: 55,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  videoThumbOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoThumbIcon: {
    fontSize: 18,
  },
  videoContainer: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginBottom: 6,
    position: 'relative' as const,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoOverlayCenter: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  blockedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 20,
    paddingHorizontal: 20,
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockedCard: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  blockedCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  tapToUnblockButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 160,
    alignItems: 'center',
  },
  tapToUnblockText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deletedMessageText: {
  fontSize: 13,
  fontStyle: "italic",
  opacity: 0.75,
},

deletedMine: {
  color: "rgba(255,255,255,0.85)",
},

deletedTheirs: {
  color: "#6b7280",
},

});

const viewerStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  closeButton: { padding: 6 },
  closeText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  counter: { color: "#fff", fontSize: 15, fontWeight: "600" },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollView: { flex: 1 },
  scrollContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.7
  },
  fullVideo: {
    width: SCREEN_W,
    height: SCREEN_H * 0.7,
  },
  noImageText: { color: "#fff", fontSize: 15 },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  navButton: { paddingHorizontal: 18, paddingVertical: 10 },
  navText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  navDisabled: { color: "#666" },
  deletedMessageText: {
  fontSize: 13,
  fontStyle: "italic",
  opacity: 0.75,
},
});

const searchModalStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: "#e5e7eb" },
  closeBtn: { padding: 6 },
  closeText: { fontSize: 15, color: COLORS.primary, fontWeight: "600" },
  input: { flex: 1, height: 40, backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 12, marginHorizontal: 8, fontSize: 15 },
  clearBtn: { padding: 6 },
  clearText: { fontSize: 15, color: "#666" },
  resultInfo: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultText: { color: "#374151", fontWeight: "600", fontSize: 14 },
});

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "transparent", justifyContent: "flex-start", alignItems: "flex-end" },
  menu: { marginTop: Platform.OS === "ios" ? 80 : 60, marginRight: 10, backgroundColor: "#fff", borderRadius: 8, paddingVertical: 4, width: 200, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  menuItem: { paddingVertical: 11, paddingHorizontal: 14 },
  menuText: { fontSize: 15, color: "#111827" },
});

const attachmentModalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  menu: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingVertical: 18, paddingHorizontal: 14, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 8 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 10, borderRadius: 10, marginBottom: 6, backgroundColor: "#f9fafb" },
  menuIcon: { fontSize: 26, marginRight: 14 },
  menuText: { fontSize: 15, color: "#111827", fontWeight: "600" },
});

export default ChatScreen;