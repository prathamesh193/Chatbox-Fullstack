// src/screens/ContactInfoScreen.tsx
import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    StatusBar,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { COLORS } from "../constants/colors";
import SystemNavigationBar from "react-native-system-navigation-bar";
import { api } from "../utils/api";

const ContactInfoScreen = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { userId, name, profilePic } = route.params || {};

    const [userDetails, setUserDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (Platform.OS === 'android') {
            SystemNavigationBar.setNavigationColor('#FFFFFF', 'dark');
            SystemNavigationBar.setNavigationBarContrastEnforced(true);
        }
    }, []);

    // Fetch user details
    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                setLoading(true);
                const response = await api.get("/api/messages/contacts");
                const contacts = response.data || [];
                const user = contacts.find((c: any) => c._id === userId);
                
                if (user) {
                    setUserDetails(user);
                }
            } catch (err) {
                console.log("Fetch user details error:", err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchUserDetails();
        } else {
            setLoading(false);
        }
    }, [userId]);

    const displayProfilePic = userDetails?.profilePic || profilePic;
    const displayName = userDetails?.fullName || name;
    const displayEmail = userDetails?.email || "Email not available";

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="light-content"
                backgroundColor={COLORS.primary}
                translucent={false}
            />

            {/* COMPACT HEADER - WhatsApp Style */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>

                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Contact info</Text>
                </View>

                <TouchableOpacity style={styles.editButton} onPress={() => Alert.alert("Edit feature coming soon!")}>
                    <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
            </View>

            {/* CONTENT */}
            <ScrollView
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                ) : (
                    <>
                        {/* Profile Section - Compact */}
                        <View style={styles.profileSection}>
                            <Image
                                source={{
                                    uri: displayProfilePic
                                        ? displayProfilePic.replace('http://localhost:3000', 'http://139.59.87.161:3000')
                                        : 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                                }}
                                style={styles.profileImage}
                            />
                            <Text style={styles.profileName}>{displayName}</Text>
                            <Text style={styles.profileEmail}>{displayEmail}</Text>
                        </View>

                        {/* Action Buttons - WhatsApp Style Grid */}
                        <View style={styles.actionsGrid}>
                            <TouchableOpacity 
                                style={styles.actionButton}
                                onPress={() => Alert.alert("Audio call coming soon!")}
                            >
                                <View style={styles.iconCircle}>
                                    <Text style={styles.actionIcon}>📞</Text>
                                </View>
                                <Text style={styles.actionLabel}>Audio</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.actionButton}
                                onPress={() => Alert.alert("Video call coming soon!")}
                            >
                                <View style={styles.iconCircle}>
                                    <Text style={styles.actionIcon}>📹</Text>
                                </View>
                                <Text style={styles.actionLabel}>Video</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.actionButton}
                                onPress={() => Alert.alert("Search in chat coming soon!")}
                            >
                                <View style={styles.iconCircle}>
                                    <Text style={styles.actionIcon}>🔍</Text>
                                </View>
                                <Text style={styles.actionLabel}>Search</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Menu Items */}
                        <View style={styles.menuSection}>
                            <TouchableOpacity 
                                style={styles.menuItem}
                                onPress={() => Alert.alert("Media feature coming soon!")}
                            >
                                <View style={styles.menuLeft}>
                                    <Text style={styles.menuIcon}>🖼️</Text>
                                    <Text style={styles.menuText}>Media, links and docs</Text>
                                </View>
                                <View style={styles.menuRight}>
                                    <Text style={styles.countText}>225</Text>
                                    <Text style={styles.arrow}>›</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuSection}>
                            <TouchableOpacity 
                                style={styles.menuItem}
                                onPress={() => Alert.alert("Starred messages coming soon!")}
                            >
                                <View style={styles.menuLeft}>
                                    <Text style={styles.menuIcon}>⭐</Text>
                                    <Text style={styles.menuText}>Starred</Text>
                                </View>
                                <View style={styles.menuRight}>
                                    <Text style={styles.countText}>5</Text>
                                    <Text style={styles.arrow}>›</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuSection}>
                            <TouchableOpacity 
                                style={styles.menuItem}
                                onPress={() => Alert.alert("Notifications settings coming soon!")}
                            >
                                <View style={styles.menuLeft}>
                                    <Text style={styles.menuIcon}>🔔</Text>
                                    <Text style={styles.menuText}>Notifications</Text>
                                </View>
                                <Text style={styles.arrow}>›</Text>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity 
                                style={styles.menuItem}
                                onPress={() => Alert.alert("Chat theme coming soon!")}
                            >
                                <View style={styles.menuLeft}>
                                    <Text style={styles.menuIcon}>🎨</Text>
                                    <Text style={styles.menuText}>Chat theme</Text>
                                </View>
                                <Text style={styles.arrow}>›</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuSection}>
                            <TouchableOpacity 
                                style={styles.menuItem}
                                onPress={() => Alert.alert("Disappearing messages coming soon!")}
                            >
                                <View style={styles.menuLeft}>
                                    <Text style={styles.menuIcon}>⏱️</Text>
                                    <Text style={styles.menuText}>Disappearing messages</Text>
                                </View>
                                <View style={styles.menuRight}>
                                    <Text style={styles.offText}>Off</Text>
                                    <Text style={styles.arrow}>›</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Danger Zone */}
                        <View style={styles.menuSection}>
                            <TouchableOpacity 
                                style={styles.menuItem}
                                onPress={() => Alert.alert("Block contact feature coming soon!")}
                            >
                                <View style={styles.menuLeft}>
                                    <Text style={styles.menuIconDanger}>🚫</Text>
                                    <Text style={styles.menuTextDanger}>Block contact</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 40 }} />
                    </>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f0f2f5",
    },

    // Compact Header - WhatsApp Style
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 8,
        paddingBottom: 8,
        backgroundColor: COLORS.primary,
        height: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 56 : 56,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
    },
    backIcon: {
        fontSize: 24,
        color: "#FFFFFF",
        fontWeight: "600",
    },
    headerCenter: {
        flex: 1,
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: "600",
        color: "#FFFFFF",
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    editText: {
        fontSize: 16,
        color: "#FFFFFF",
        fontWeight: "500",
    },

    // Content
    scrollView: {
        flex: 1,
    },
    loadingContainer: {
        paddingTop: 60,
        alignItems: "center",
    },

    // Profile Section - Compact
    profileSection: {
        alignItems: "center",
        paddingTop: 24,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: "#FFFFFF",
    },
    profileImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#e5e7eb",
        marginBottom: 16,
    },
    profileName: {
        fontSize: 22,
        fontWeight: "600",
        color: "#000000",
        marginBottom: 4,
    },
    profileEmail: {
        fontSize: 15,
        color: "#667781",
    },

    // Actions Grid - WhatsApp Style
    actionsGrid: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        paddingVertical: 16,
        paddingHorizontal: 20,
        justifyContent: "space-around",
        marginTop: 8,
    },
    actionButton: {
        alignItems: "center",
        minWidth: 80,
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#f0f2f5",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 6,
    },
    actionIcon: {
        fontSize: 20,
    },
    actionLabel: {
        fontSize: 13,
        color: "#667781",
        fontWeight: "400",
    },

    // Menu Sections
    menuSection: {
        backgroundColor: "#FFFFFF",
        marginTop: 8,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 16,
        minHeight: 56,
    },
    menuLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    menuIcon: {
        fontSize: 20,
        marginRight: 32,
        width: 24,
        textAlign: "center",
    },
    menuIconDanger: {
        fontSize: 20,
        marginRight: 32,
        width: 24,
        textAlign: "center",
    },
    menuText: {
        fontSize: 16,
        color: "#000000",
        fontWeight: "400",
    },
    menuTextDanger: {
        fontSize: 16,
        color: "#dc2626",
        fontWeight: "400",
    },
    menuRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    countText: {
        fontSize: 14,
        color: "#667781",
        marginRight: 8,
    },
    offText: {
        fontSize: 14,
        color: "#667781",
        marginRight: 4,
    },
    arrow: {
        fontSize: 20,
        color: "#8696a0",
        fontWeight: "300",
    },
    divider: {
        height: 1,
        backgroundColor: "#e9edef",
        marginLeft: 72,
    },
});

export default ContactInfoScreen;