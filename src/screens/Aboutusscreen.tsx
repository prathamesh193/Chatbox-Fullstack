// src/screens/AboutUsScreen.tsx
import React, { useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StatusBar,
  StyleSheet,
  Platform,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../constants/colors";
import SystemNavigationBar from "react-native-system-navigation-bar";

const brahmanLogo = require('../assets/brahman-logo.jpeg');

const AboutUsScreen = () => {
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemNavigationBar.setNavigationColor('#FFFFFF', 'dark');
      SystemNavigationBar.setNavigationBarContrastEnforced(true);
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.primary}
        translucent={false}
      />

      <View style={styles.headerWrapper}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                About Us
              </Text>
            </View>

            <View style={styles.logoContainer}>
              <Image
                source={brahmanLogo}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
          </View>
        </SafeAreaView>

        <View style={styles.headerBorder} />
      </View>

      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.contentWrapper}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>💬</Text>
          </View>

          <Text style={styles.welcomeText}>
            Welcome to Brahman Connect
          </Text>

          <View style={styles.divider} />

          <Text style={styles.descriptionText}>
            The <Text style={styles.boldText}>Brahmin Connect Chat</Text> feature enables seamless, real-time communication within the app. Designed for smooth and secure conversations, it allows users to connect instantly with service providers and community members without leaving the platform.
          </Text>

          <View style={styles.featureContainer}>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Real-time messaging</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Secure conversations</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureDot} />
              <Text style={styles.featureText}>Instant connectivity</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

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

  contentContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  contentWrapper: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 20,
  },
  iconText: {
    fontSize: 32,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  divider: {
    height: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 20,
    width: "100%",
  },
  descriptionText: {
    fontSize: 16,
    color: "#4B5563",
    lineHeight: 26,
    textAlign: "left",
    marginBottom: 24,
  },
  boldText: {
    fontWeight: "700",
    color: COLORS.primary,
  },
  featureContainer: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },
  featureText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
});

export default AboutUsScreen;