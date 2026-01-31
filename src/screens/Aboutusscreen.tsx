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
        <View style={styles.textContainer}>
          <Text style={styles.contentText}>
            Welcome to Brahman Connect
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
  },
  contentWrapper: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  textContainer: {
    flex: 1,
  },
  contentText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 26,
    textAlign: "left",
  },
});

export default AboutUsScreen;