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
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../constants/colors";
import { api } from "../utils/api";
import { formatMessageTime } from "../utils/time";

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
  const [selectedTab, setSelectedTab] = useState(TAB_CONTACTS);

  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(0))[0];

  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionTarget, setActionTarget] = useState<any>(null);

  // ------------------------------------------------------
  // CLEAN SEARCH RANKING
  // ------------------------------------------------------
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

  // ------------------------------------------------------sss
  // CHAT ORDERING - pin first then most recent activity
  // ------------------------------------------------------
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

  // ------------------------------------------------------
  // FETCH LISTS
  // ------------------------------------------------------
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

      // Contacts
      if (contactsRes.status === "fulfilled")
        setContacts(contactsRes.value.data || []);
      else setContacts([]);

      // Chats (raw list)
      let rawChats: any[] = [];
      if (chatsRes.status === "fulfilled")
        rawChats = chatsRes.value.data || [];

      // Blocked
      if (blockedRes.status === "fulfilled")
        setBlockedIds(
          (blockedRes.value.data || []).map((u: any) => String(u._id))
        );

      // Pinned
      let pinnedList: string[] = [];
      if (pinnedRes.status === "fulfilled")
        pinnedList = (pinnedRes.value.data || []).map((u: any) =>
          String(u._id)
        );

      setPinnedIds(pinnedList);

      // ORDER CHATS - using new pinned list
      const ordered = orderChats(rawChats, pinnedList);
      setChats(ordered);

    } catch (err) {
      console.log("Fetch error:", err);
      Alert.alert("Error", "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  const [myId, setMyId] = useState("");

  // Load my userId once (from AsyncStorage)
  useEffect(() => {
    const loadMyId = async () => {
      try {
        const id = await AsyncStorage.getItem("userId");
        if (id) setMyId(id);
      } catch (e) {
        console.log("Error loading userId:", e);
      }
    };

    loadMyId();
  }, []);

  // Fetch contacts + chats list
  useEffect(() => {
    fetchLists();
  }, []);

  // Sidebar slide animation (MUST be the third effect)
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: profileMenuVisible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [profileMenuVisible]);

  // ------------------------------------------------------
  // ACTION MENU
  // ------------------------------------------------------
  const openActionMenu = (user: any) => {
    setActionTarget(user);
    setActionModalVisible(true);
  };

  const closeActionMenu = () => {
    setActionModalVisible(false);
    setActionTarget(null);
  };

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

  // ------------------------------------------------------
  // RENDER ITEM
  // ------------------------------------------------------
  const renderItem = ({ item }: any) => {
    const isPinned = pinnedIds.includes(String(item._id));

    // Determine what to show under the username
    let lastText = "Tap to message";
    let isUnread = false;

    // if (item.lastMessage) {
    //   const msg = item.lastMessage;
    //   const isMe = msg.senderId === myId;

    //   if (isMe) {
    //     // Messages YOU sent
    //     if (msg.status === "sent") lastText = "Message sent";
    //     else if (msg.status === "delivered") lastText = "Message delivered";
    //     else if (msg.status === "read") lastText = "Message seen";
    //   } else {
    //     // Messages THEY sent
    //     if (msg.status !== "read") {
    //       lastText = "Sent a message";
    //       isUnread = true;
    //     } else {
    //       // already read → show message text
    //       lastText = msg.text || (msg.image ? "📷 Image" : "Message");
    //     }
    //   }
    // }
    // Check if I blocked this user
    const iBlockedThem = blockedIds.includes(String(item._id));

    if (iBlockedThem) {
      lastText = "You blocked this contact";
      isUnread = false;
    } else if (item.lastMessage) {
      const msg = item.lastMessage;
      const isMe = msg.senderId === myId;

      if (isMe) {
        // Messages YOU sent
        if (msg.status === "sent") lastText = "Message sent";
        else if (msg.status === "delivered") lastText = "Message delivered";
        else if (msg.status === "read") lastText = "Message seen";
      } else {
        // Messages THEY sent
        if (msg.status !== "read") {
          lastText = "Sent a message";
          isUnread = true;
        } else {
          // already read → show message text
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
        style={styles.userCard}
        onPress={() =>
          navigation.navigate("Chat", {
            userId: item._id,
            name: item.fullName,
          })
        }
        onLongPress={() => openActionMenu(item)}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{
              uri:
                item.profilePic ||
                "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            style={styles.avatar}
          />
        </View>

        <View style={styles.userInfo}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={styles.name}>{item.fullName}</Text>

            {selectedTab === TAB_CHATS && lastTime && (
              <Text style={{ fontSize: 12, color: "#9ca3af" }}>
                {formatMessageTime(lastTime)}
              </Text>
            )}
          </View>

          <Text
            numberOfLines={1}
            style={[styles.lastSeen, isUnread && styles.unreadText]}
          >
            {lastText}
          </Text>

        </View>

        <View style={styles.chatArrow}>
          {isUnread ? (
            <Text style={styles.unreadDot}>●</Text>
          ) : isPinned ? (
            <Text style={styles.pinIcon}>📌</Text>
          ) : (
            <Text style={styles.chatArrowIcon}>›</Text>
          )}
        </View>

      </TouchableOpacity>
    );
  };

  // ------------------------------------------------------
  // LIST DATA
  // ------------------------------------------------------
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

  // ------------------------------------------------------
  // UI
  // ------------------------------------------------------
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={COLORS.primary} />

      {/* HEADER */}
      <View style={styles.header}>
        {/* LOGO */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/brahman-logo.jpeg')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {listToShow.length} conversations
          </Text>
        </View>

        <TouchableOpacity
          style={styles.profileIconContainer}
          onPress={() => setProfileMenuVisible(true)}
        >
          <Image
            source={{
              uri: "https://cdn-icons-png.flaticon.com/512/709/709722.png",
            }}
            style={styles.profileImage}
          />
        </TouchableOpacity>
      </View>


      {/* TABS */}
      <View style={tabsStyles.tabRow}>
        <TouchableOpacity
          style={[
            tabsStyles.tabButton,
            selectedTab === TAB_CONTACTS && tabsStyles.tabActive,
          ]}
          onPress={() => setSelectedTab(TAB_CONTACTS)}
        >
          <Text
            style={[
              tabsStyles.tabText,
              selectedTab === TAB_CONTACTS && tabsStyles.tabTextActive,
            ]}
          >
            Contacts
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            tabsStyles.tabButton,
            selectedTab === TAB_CHATS && tabsStyles.tabActive,
          ]}
          onPress={() => setSelectedTab(TAB_CHATS)}
        >
          <Text
            style={[
              tabsStyles.tabText,
              selectedTab === TAB_CHATS && tabsStyles.tabTextActive,
            ]}
          >
            Chats
          </Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View style={searchStyles.searchRow}>
        <TextInput
          placeholder={
            selectedTab === TAB_CONTACTS
              ? "Search contacts..."
              : "Search chats..."
          }
          value={search}
          onChangeText={setSearch}
          style={searchStyles.searchInput}
        />

        <TouchableOpacity style={searchStyles.refreshBtn} onPress={fetchLists}>
          <Text style={searchStyles.refreshText}>⟳</Text>
        </TouchableOpacity>
      </View>

      {/* LIST */}
      <FlatList
        data={listToShow}
        keyExtractor={(item) => String(item._id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* ACTION MODAL */}
      <Modal visible={actionModalVisible} transparent animationType="fade">
        <View style={styles.actionModalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.actionModalTitle}>
              {actionTarget?.fullName}
            </Text>

            {/* PIN / UNPIN */}
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

            {/* CANCEL */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={closeActionMenu}
            >
              <Text style={styles.actionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* SIDEBAR MENU */}
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
                      outputRange: [300, 0], // slide from right
                    }),
                  },
                ],
              },
            ]}
          >
            {/* SIDEBAR HEADER */}
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Profile</Text>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setProfileMenuVisible(false)}
              >
                <Text style={styles.closeIcon}>×</Text>
              </TouchableOpacity>
            </View>

            {/* PROFILE SECTION */}
            <View style={styles.profileSection}>
              <View style={styles.profileImageWrapper}>
                <Image
                  source={{
                    uri: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                  }}
                  style={styles.largeProfileImage}
                />
                <View style={styles.profileImageGlow} />
              </View>
              <Text style={styles.userName}>Your Profile</Text>
              <View style={styles.profileDivider} />
            </View>

            {/* LOGOUT */}
            <View style={styles.logoutSection}>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={async () => {
                  console.log("🚪 Starting logout...");
                  await AsyncStorage.multiRemove(['token', 'userId', 'userData']);
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                  });
                  console.log("✅ Logout complete");
                }}
              >
                <Text style={styles.logoutText}>Logout</Text>
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
    backgroundColor: "#f8fafc",
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

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,  // was 60
    paddingBottom: 16, // was 20
    paddingHorizontal: 20, // was 24
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 24, // was 32
    borderBottomRightRadius: 24, // was 32
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 }, // was 15
    shadowOpacity: 0.25, // was 0.3
    shadowRadius: 20, // was 25
    elevation: 8, // was 10
  },

  headerLeft: {
    flexDirection: "column",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 28, // was 36
    fontWeight: "800",
    letterSpacing: -0.5, // was -1
    marginBottom: 2, // was 4
  },

  headerSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14, // was 16
    fontWeight: "600",
  },

  profileIconContainer: {
    width: 40, // was 44
    height: 40, // was 44
    borderRadius: 20, // was 22
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },

  profileImage: {
    width: 20, // was 22
    height: 20, // was 22
    tintColor: "#fff",
  },

  // modal / sidebar
  modalContainer: {
    flex: 1,
    flexDirection: "row",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  overlayTouchable: {
    flex: 1,
  },
  sidebar: {
    width: 340,
    height: "100%",
    backgroundColor: "#fff",
    elevation: 25,
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

  // list
  listContainer: {
    padding: 16, // was 20
    paddingBottom: 30, // was 40
  },

  userCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 14, // was 20
    marginVertical: 6, // was 8
    borderRadius: 16, // was 24
    alignItems: "center",
    elevation: 2, // was 4
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },

  avatarContainer: {
    position: "relative",
    marginRight: 12, // was 18
  },

  avatar: {
    width: 52, // was 64
    height: 52, // was 64
    borderRadius: 26, // was 32
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
    fontSize: 16, // was 18
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 4, // was 6
  },

  lastSeen: {
    fontSize: 13, // was 14
    color: "#64748b",
    fontWeight: "500",
  },

  chatArrow: {
    marginLeft: "auto",
  },
  chatArrowIcon: {
    fontSize: 20, // was 24
    color: COLORS.primary,
    fontWeight: "300",
  },

  pinIcon: {
    fontSize: 16, // was 18
    marginRight: 4, // was 6
  },

  // empty
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

  /* Action modal */
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
    color: "#1e3a8a", // blue shade
  },

  unreadDot: {
    fontSize: 18, // was 20
    color: "#2563eb",
    marginRight: 4, // was 6
    marginTop: 2,
  },

  logoContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  logoImage: {
    width: 40,
    height: 40,
  },

});

/* Tabs styles */
const tabsStyles = StyleSheet.create({
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16, // was 20
    marginTop: 10, // was 14
    gap: 10, // was 12
  },

  tabButton: {
    flex: 1,
    paddingVertical: 10, // was 12
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 15, // was 16
    fontWeight: "600",
    color: COLORS.textDark,
  },
  tabTextActive: {
    color: "#fff",
  },
});

/* Search styles */
const searchStyles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    paddingHorizontal: 16, // was 20
    marginTop: 10, // was 12
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    height: 42, // was 44
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 15, // ADD THIS
  },

  refreshBtn: {
    marginLeft: 8,
    width: 42, // was 44
    height: 42, // was 44
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  refreshText: {
    fontSize: 18,
  },
  contactTime: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
});


export default HomeScreen;
