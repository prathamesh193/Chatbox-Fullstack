// src/screens/ContactsScreen.tsx
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    StatusBar,
    TextInput,
    StyleSheet,
    Platform,
    SafeAreaView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../constants/colors";
import { api } from "../utils/api";
import SystemNavigationBar from "react-native-system-navigation-bar";

const brahmanLogo = require('../assets/brahman-logo.jpeg');

const ContactsScreen = () => {
    const navigation = useNavigation<any>();

    const [contacts, setContacts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (Platform.OS === 'android') {
            SystemNavigationBar.setNavigationColor('#FFFFFF', 'dark');
            SystemNavigationBar.setNavigationBarContrastEnforced(true);
        }
    }, []);

    // Fetch contacts
    useEffect(() => {
        const fetchContacts = async () => {
            try {
                setLoading(true);
                const token = await AsyncStorage.getItem("token");
                if (!token) return navigation.navigate("Login");

                const response = await api.get("/api/messages/contacts");
                setContacts(response.data || []);
            } catch (err) {
                console.log("Fetch contacts error:", err);
                Alert.alert("Error", "Failed to load contacts");
            } finally {
                setLoading(false);
            }
        };

        fetchContacts();
    }, []);

    // Search ranking function
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

    // Filter and rank contacts
    const filteredContacts = rankResults(
        contacts.filter((u) =>
            String(u.fullName || "").toLowerCase().includes(search.toLowerCase())
        ),
        search
    );

    // Render contact item
    const renderItem = ({ item }: any) => {
        return (
            <TouchableOpacity
                style={styles.contactRow}
                onPress={() =>
                    navigation.navigate("Chat", {
                        userId: item._id,
                        name: item.fullName,
                    })
                }
            >
                <Image
                    source={{
                        uri:
                            item.profilePic ||
                            "https://cdn-icons-png.flaticon.com/512/149/149071.png",
                    }}
                    style={styles.contactAvatar}
                />

                <View style={styles.contactInfo}>
                    <Text style={styles.contactName} numberOfLines={1}>
                        {item.fullName}
                    </Text>
                    <Text style={styles.contactStatus}>
                        Tap to message
                    </Text>
                </View>

                <Text style={styles.contactArrow}>›</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="light-content"
                backgroundColor={COLORS.primary}
                translucent={false}
            />

            {/* HEADER WITH SAFE AREA */}
            <View style={styles.headerWrapper}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        {/* Back Button */}
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.backIcon}>←</Text>
                        </TouchableOpacity>

                        {/* Title */}
                        <View style={styles.headerCenter}>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                Contacts
                            </Text>
                        </View>

                        {/* Logo on Right */}
                        <View style={styles.logoContainer}>
                            <Image
                                source={brahmanLogo}
                                style={styles.logoImage}
                                resizeMode="cover"
                            />
                        </View>
                    </View>
                </SafeAreaView>

                {/* Yellow Bottom Border */}
                <View style={styles.headerBorder} />
            </View>

            {/* SEARCH BAR */}
            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        placeholder="Search contacts"
                        placeholderTextColor="#9ca3af"
                        value={search}
                        onChangeText={setSearch}
                        style={styles.searchInput}
                    />
                </View>
            </View>

            {/* Contacts Count */}
            <View style={styles.countContainer}>
                <Text style={styles.countText}>
                    {filteredContacts.length} {filteredContacts.length === 1 ? 'Contact' : 'Contacts'}
                </Text>
            </View>

            {/* CONTACTS LIST */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredContacts}
                    keyExtractor={(item) => String(item._id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyCircle}>
                                <Text style={styles.emptyEmoji}>👥</Text>
                            </View>
                            <Text style={styles.emptyTitle}>No Contacts Found</Text>
                            <Text style={styles.emptyDescription}>
                                {search ? "Try a different search term" : "Your contacts will appear here"}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },

    // Header styles
    headerWrapper: {
        backgroundColor: COLORS.primary,
    },
    safeArea: {
        backgroundColor: COLORS.primary,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 38 : 8,
        paddingBottom: 12,
        backgroundColor: COLORS.primary,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 20,
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    backIcon: {
        fontSize: 24,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    headerCenter: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: "#FFFFFF",
        letterSpacing: 0.3,
    },
    logoContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 6,
        overflow: 'hidden',
        elevation: 2,
        justifyContent: "center",
        alignItems: "center",
        width: 40,
        height: 40,
    },
    logoImage: {
        width: 28,
        height: 28,
    },
    headerBorder: {
        height: 3,
        backgroundColor: COLORS.primary,
    },

    // Search bar
    searchRow: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: "#FFFFFF",
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

    // Count
    countContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
    },
    countText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
    },

    // List
    listContainer: {
        paddingBottom: 20,
    },

    // Contact row
    contactRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: "#f8fafc",
        borderBottomWidth: 1,
        borderBottomColor: "#e5e7eb",
    },
    contactAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        backgroundColor: "#e5e7eb",
    },
    contactInfo: {
        flex: 1,
    },
    contactName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111827",
        marginBottom: 2,
    },
    contactStatus: {
        fontSize: 13,
        color: "#6b7280",
    },
    contactArrow: {
        fontSize: 24,
        color: COLORS.primary,
        fontWeight: "300",
    },

    // Loading
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },

    // Empty state
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
        paddingTop: 60,
    },
    emptyCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#f0f4ff",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    emptyEmoji: {
        fontSize: 40,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 8,
        textAlign: "center",
    },
    emptyDescription: {
        fontSize: 15,
        color: "#64748b",
        textAlign: "center",
        lineHeight: 22,
    },
});

export default ContactsScreen;