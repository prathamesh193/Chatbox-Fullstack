// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  StatusBar,
  TextInput,
  StyleSheet,
  Platform,
  SafeAreaView,
} from "react-native";
import { pushService } from "../services/pushNotificationService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../constants/colors";
import { api } from "../utils/api";
import { formatMessageTime } from "../utils/time";
import SystemNavigationBar from "react-native-system-navigation-bar";
import { useFocusEffect } from '@react-navigation/native';

const brahmanLogo = require('../assets/brahman-logo.jpeg');
const TAB_CONTACTS = "contacts";
const TAB_CHATS = "chats";

const HomeScreen = () => {
  const navigation = useNavigation<any>();

  const [contacts, setContacts] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [selectedTab, setSelectedTab] = useState(TAB_CHATS);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [profilePic, setProfilePic] = useState("");

  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(0))[0];

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionTarget, setActionTarget] = useState<any>(null);
  const [myId, setMyId] = useState("");

  // Initialize push notifications for logged-in user
  useEffect(() => {
    const initPush = async () => {
      const userId = await AsyncStorage.getItem("userId");
      if (userId) {
        await pushService.initialize(userId);
      }
    };
    initPush();
  }, []);

  // Configure Android navigation bar styling
  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemNavigationBar.setNavigationColor('#FFFFFF', 'dark');
      SystemNavigationBar.setNavigationBarContrastEnforced(true);
    }
  }, []);

  // Search ranking: prioritize names that start with query, then names that include it
  const rankResults = (list: any[], q: string) => {
    if (!q) return list;
    const L = q.toLowerCase();

    const starts = [];
    const includes = [];

    for (let item of list) {
      const name = (item.fullName || "").toLowerCase();
      if (name.startsWith(L)) starts.push(item);
      else if (name.includes(L)) includes.push(item);
    }

    return [...starts, ...includes];
  };

  // Order chats: pinned chats first (sorted by recent activity), then unpinned chats (sorted by recent activity)
  const orderChats = (list: any[], pinnedArr: string[]) => {
    const pinnedSet = new Set(pinnedArr);

    const getTS = (x: any) =>
      new Date(
        x.lastMessageAt ||
        x.lastMessage?.createdAt ||
        x.updatedAt ||
        0
      ).getTime();

    const pinned = list.filter((u) => pinnedSet.has(String(u._id)));
    const others = list.filter((u) => !pinnedSet.has(String(u._id)));

    pinned.sort((a, b) => getTS(b) - getTS(a));
    others.sort((a, b) => getTS(b) - getTS(a));

    return [...pinned, ...others];
  };

  // Fetch contacts, chats, blocked users, and pinned chats from API
  const fetchLists = async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) return navigation.navigate("Login");

      const [contactsRes, chatsRes, blockedRes, pinnedRes] =
        await Promise.allSettled([
          api.get("/api/messages/contacts"),
          api.get("/api/messages/chats"),
          api.get("/api/users/blocked"),
          api.get("/api/users/pinned"),
        ]);

      if (contactsRes.status === "fulfilled")
        setContacts(contactsRes.value.data || []);
      else setContacts([]);

      let rawChats: any[] = [];
      if (chatsRes.status === "fulfilled")
        rawChats = chatsRes.value.data || [];

      if (blockedRes.status === "fulfilled")
        setBlockedIds(
          (blockedRes.value.data || []).map((u: any) => String(u._id))
        );

      let pinnedList: string[] = [];
      if (pinnedRes.status === "fulfilled")
        pinnedList = (pinnedRes.value.data || []).map((u: any) =>
          String(u._id)
        );

      setPinnedIds(pinnedList);

      const ordered = orderChats(rawChats, pinnedList);
      setChats(ordered);

    } catch (err) {
      Alert.alert("Error", "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  // Load current user's ID from storage
  useEffect(() => {
    const loadMyId = async () => {
      try {
        const id = await AsyncStorage.getItem("userId");
        if (id) setMyId(id);
      } catch (e) {
        // Silent fail
      }
    };
    loadMyId();
  }, []);

  // Load current user profile data from API
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        try {
          const response = await api.get("/api/profile/me");

          if (response.data.success && response.data.user) {
            const user = response.data.user;
            setUserName(user.fullName || "");
            setUserEmail(user.email || "");
            setProfilePic(user.profilePic || "");
          }
        } catch (apiError) {
        }
      } catch (e) {
      }
    };
    loadUserData();
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchLists();
  }, []);

  // Animate sidebar slide in/out
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: profileMenuVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [profileMenuVisible]);

  // Reload user data and chats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const reloadData = async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          if (!token) return;

          const response = await api.get("/api/profile/me");

          if (response.data.success && response.data.user) {
            const user = response.data.user;
            setUserName(user.fullName || "");
            setUserEmail(user.email || "");
            setProfilePic(user.profilePic || "");
          }
        } catch (err) {
        }
      };

      reloadData();
      fetchLists();
    }, [])
  );

  // Open action menu for a specific chat (pin/unpin)
  const openActionMenu = (user: any) => {
    setActionTarget(user);
    setActionModalVisible(true);
  };

  const closeActionMenu = () => {
    setActionModalVisible(false);
    setActionTarget(null);
  };

  // Toggle pin status for a chat
  const handlePinToggle = async () => {
    if (!actionTarget) return;
    try {
      const id = String(actionTarget._id);

      if (pinnedIds.includes(id)) {
        await api.post(`/api/users/unpin/${id}`);
      } else {
        await api.post(`/api/users/pin/${id}`);
      }

      await fetchLists();
    } catch (e) {
      Alert.alert("Error");
    }
    closeActionMenu();
  };

  // Render individual chat item with message preview and status
  const renderItem = ({ item }: any) => {
    const isPinned = pinnedIds.includes(String(item._id));

    let lastText = "Tap to message";
    let isUnread = false;

    const iBlockedThem = blockedIds.includes(String(item._id));

    if (iBlockedThem) {
      lastText = "You blocked this contact";
      isUnread = false;
    } else if (item.lastMessage) {
      const msg = item.lastMessage;
      const isMe = msg.senderId === myId;

      if (isMe) {
        if (msg.status === "sent") lastText = "Message sent";
        else if (msg.status === "delivered") lastText = "Message delivered";
        else if (msg.status === "read") lastText = "Message seen";
      } else {
        if (msg.status !== "read") {
          lastText = "Sent a message";
          isUnread = true;
        } else {
          lastText = msg.text || (msg.image ? "📷 Image" : "Message");
        }
      }
    }

    const lastTime =
      item.lastMessageAt ||
      item.lastMessage?.createdAt ||
      item.updatedAt ||
      null;

    return (
      <TouchableOpacity
        style={styles.igRow}
        onPress={() =>
          navigation.navigate("Chat", {
            userId: item._id,
            name: item.fullName,
            profilePic: item.profilePic,
          })
        }
        onLongPress={() => openActionMenu(item)}
      >
        <Image
          source={{ uri: item.profilePic ? item.profilePic.replace('http://localhost:3000', 'http://139.59.87.161:3000') : 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
          style={styles.igAvatar}
        />

        <View style={styles.igContent}>
          <View style={styles.igTopRow}>
            <Text style={styles.igName} numberOfLines={1}>
              {item.fullName}
            </Text>

            {lastTime && (
              <Text style={styles.igTime}>
                {formatMessageTime(lastTime)}
              </Text>
            )}
          </View>

          <Text
            numberOfLines={1}
            style={[styles.igMessage, isUnread && styles.igUnread]}
          >
            {lastText}
          </Text>
        </View>

        {isUnread ? (
          <View style={styles.igUnreadDot} />
        ) : isPinned ? (
          <Text style={styles.igPin}>📌</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Filter and rank the list based on search query
  const listToShow =
    selectedTab === TAB_CONTACTS
      ? rankResults(
        contacts.filter((u) =>
          String(u.fullName || "").toLowerCase().includes(search.toLowerCase())
        ),
        search
      )
      : rankResults(
        chats.filter((u) =>
          String(u.fullName || "").toLowerCase().includes(search.toLowerCase())
        ),
        search
      );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Header with logo, username, and hamburger menu */}
      <View style={styles.headerWrapper}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/brahman-logo.jpeg')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            <View style={styles.headerCenter}>
              <Text style={styles.usernameText} numberOfLines={1}>
                {userName || "User"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.hamburgerButton}
              onPress={() => setProfileMenuVisible(true)}
            >
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
              <View style={styles.hamburgerLine} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={styles.headerBorder} />
      </View>

      {/* Search bar */}
      <View style={searchStyles.searchRow}>
        <View style={searchStyles.searchContainer}>
          <Text style={searchStyles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            style={searchStyles.searchInput}
          />
        </View>
      </View>

      <View style={styles.messagesLabelContainer}>
        <Text style={styles.messagesLabel}>Messages</Text>
      </View>

      {/* Chat list */}
      <FlatList
        data={listToShow}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIllustration}>
                <View style={styles.emptyCircle}>
                  <Text style={styles.emptyEmoji}>💬</Text>
                </View>
              </View>
              <Text style={styles.emptyTitle}>No Conversations Yet</Text>
              <Text style={styles.emptyDescription}>
                Start a conversation to see your messages here
              </Text>
            </View>
          ) : null
        }
      />

      {/* Action modal for pin/unpin */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.actionModalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.actionModalTitle}>
              {actionTarget?.fullName}
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handlePinToggle}
            >
              <Text style={styles.actionText}>
                {pinnedIds.includes(String(actionTarget?._id))
                  ? "Unpin chat"
                  : "Pin chat"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeActionMenu}
            >
              <Text style={styles.actionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sidebar navigation menu */}
      <Modal visible={profileMenuVisible} transparent animationType="none">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            onPress={() => setProfileMenuVisible(false)}
          >
            <Animated.View style={[styles.overlay, { opacity: slideAnim }]} />
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.sidebar,
              {
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-280, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* User profile section */}
            <View style={styles.drawerHeader}>
              <TouchableOpacity
                style={styles.drawerBackButton}
                onPress={() => setProfileMenuVisible(false)}
              >
                <Text style={styles.drawerBackButtonText}>←</Text>
              </TouchableOpacity>

              <View style={styles.drawerProfileSection}>
                <View style={styles.drawerAvatarWrapper}>
                  <Image
                    source={{ uri: profilePic ? profilePic.replace('http://localhost:3000', 'http://139.59.87.161:3000') : 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }}
                    style={styles.drawerAvatar}
                  />
                </View>
                <Text style={styles.drawerUserName} numberOfLines={1}>
                  {userName || "User"}
                </Text>
                <Text style={styles.drawerUserEmail} numberOfLines={1}>
                  {userEmail || "user@example.com"}
                </Text>
              </View>
            </View>

            {/* Navigation menu items */}
            <View style={styles.drawerMenu}>
              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setProfileMenuVisible(false);
                  navigation.navigate("Profile");
                }}
              >
                <View style={styles.drawerMenuIcon}>
                  <Text style={styles.drawerMenuIconText}>👤</Text>
                </View>
                <Text style={styles.drawerMenuText}>My Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setProfileMenuVisible(false);
                  navigation.navigate("Contacts");
                }}
              >
                <View style={styles.drawerMenuIcon}>
                  <Text style={styles.drawerMenuIconText}>👥</Text>
                </View>
                <Text style={styles.drawerMenuText}>Contacts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setProfileMenuVisible(false);
                  Alert.alert("Announcement", "This Feature will be added soon");
                }}
              >
                <View style={styles.drawerMenuIcon}>
                  <Text style={styles.drawerMenuIconText}>📢</Text>
                </View>
                <Text style={styles.drawerMenuText}>Announcement</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.drawerMenuItem}
                onPress={() => {
                  setProfileMenuVisible(false);
                  navigation.navigate("AboutUs");
                }}
              >
                <View style={styles.drawerMenuIcon}>
                  <Text style={styles.drawerMenuIconText}>ℹ️</Text>
                </View>
                <Text style={styles.drawerMenuText}>About Us</Text>
              </TouchableOpacity>
            </View>

            {/* Logout button */}
            <View style={styles.drawerFooter}>
              <TouchableOpacity
                style={styles.drawerLogoutButton}
                onPress={async () => {
                  await AsyncStorage.multiRemove(['token', 'userId', 'userData', 'fullName']);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                }}
              >
                <Text style={styles.drawerLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "System" : undefined,
  },
  sidebarTitleContainer: {
    flex: 1,
  },
  headerWrapper: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  safeArea: {
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 38 : 8,
    paddingBottom: 12,
    backgroundColor: COLORS.primary,
    justifyContent: "space-between",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    elevation: 2,
  },
  hamburgerButton: {
    padding: 8,
    justifyContent: "center",
    alignItems: "flex-start",
    width: 44,
    height: 44,
  },
  hamburgerLine: {
    width: 22,
    height: 2.5,
    backgroundColor: "#FFFFFF",
    marginVertical: 2.5,
    borderRadius: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    height: 44,
  },
  usernameText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  headerBorder: {
    height: 3,
    backgroundColor: COLORS.primary,
  },
  messagesLabelContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  messagesLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.3,
  },
  modalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  overlayTouchable: {
    flex: 1,
  },
  sidebar: {
    width: 280,
    height: "100%",
    backgroundColor: "#FFFFFF",
    elevation: 25,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  drawerHeader: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 50 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  drawerProfileSection: {
    alignItems: "flex-start",
  },
  drawerAvatarWrapper: {
    marginBottom: 12,
  },
  drawerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  drawerUserName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  drawerUserEmail: {
    fontSize: 14,
    fontWeight: "400",
    color: "#FFFFFF",
    opacity: 0.9,
  },
  drawerMenu: {
    flex: 1,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
  },
  drawerMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  drawerMenuIcon: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "#FFF5E6",
    borderRadius: 18,
  },
  drawerMenuIconText: {
    fontSize: 18,
  },
  drawerMenuText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  drawerFooter: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  drawerLogoutButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  drawerLogoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626",
  },
  drawerBackButton: {
    position: "absolute",
    top: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 46 : 46,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  drawerBackButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 25,
  },
  sidebarTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.textDark,
    letterSpacing: -1,
  },
  sidebarTitleLine: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    fontSize: 20,
    color: COLORS.textDark,
    fontWeight: "300",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 28,
  },
  profileImageWrapper: {
    position: "relative",
    marginBottom: 25,
  },
  largeProfileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: "#fff",
  },
  profileImageGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginHorizontal: 20,
  },
  userName: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textDark,
    textAlign: "center",
  },
  profileDivider: {
    width: 60,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginTop: 20,
    opacity: 0.6,
  },
  menuSection: {
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  menuItem: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
  },
  menuItemText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textDark,
    textAlign: "center",
  },
  logoutSection: {
    padding: 28,
    marginTop: "auto",
  },
  logoutButton: {
    backgroundColor: "#fff",
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fee2e2",
  },
  logoutIcon: {
    marginRight: 12,
  },
  logoutIconText: {
    fontSize: 18,
  },
  logoutText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#dc2626",
  },
  sidebarFooter: {
    padding: 28,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  footerText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  userCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14,
    marginVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 4,
  },
  lastSeen: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  chatArrow: {
    marginLeft: "auto",
  },
  chatArrowIcon: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: "300",
  },
  pinIcon: {
    fontSize: 16,
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 40,
  },
  emptyIllustration: {
    position: "relative",
    marginBottom: 30,
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0f4ff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 12,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  actionModal: {
    backgroundColor: "#fff",
    padding: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionButton: {
    width: "100%",
  },
  cancelButton: {
    marginTop: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    alignItems: "center",
    paddingVertical: 12,
  },
  actionText: {
    textAlign: "center",
    fontSize: 16,
    color: COLORS.textDark,
  },
  destructiveText: {
    color: "#dc2626",
    fontWeight: "700",
  },
  unreadText: {
    fontWeight: "700",
    color: "#1e3a8a",
  },
  unreadDot: {
    fontSize: 18,
    color: "#2563eb",
    marginRight: 4,
    marginTop: 2,
  },
  logoContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 6,
    overflow: 'hidden',
    elevation: 2,
    justifyContent: "center",
    alignItems: "center",
    width: 46,
    height: 46,
  },
  logoImage: {
    width: 32,
    height: 32,
  },
  igRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  igAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "#e5e7eb",
  },
  igContent: {
    flex: 1,
  },
  igTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  igName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  igTime: {
    fontSize: 11,
    color: "#9ca3af",
    marginLeft: 8,
  },
  igMessage: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 1,
    letterSpacing: 0.2,
  },
  igUnread: {
    fontWeight: "600",
    color: "#111827",
  },
  igUnreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  igPin: {
    fontSize: 14,
    marginLeft: 8,
  },
});

const tabsStyles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#fff",
  },
});

const searchStyles = StyleSheet.create({
  searchRow: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: "transparent",
    fontSize: 15,
    color: "#111827",
    paddingVertical: 0,
  },
  refreshBtn: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  refreshText: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: "600",
  },
  contactTime: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
});

export default HomeScreen;