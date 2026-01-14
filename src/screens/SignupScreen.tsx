import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { api } from "../utils/api";
import { COLORS } from "../constants/colors";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import SystemNavigationBar from "react-native-system-navigation-bar";

type SignupScreenProp = NativeStackNavigationProp<RootStackParamList, "Signup">;

const SignupScreen = () => {
  const navigation = useNavigation<SignupScreenProp>();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemNavigationBar.setNavigationColor('#FFFFFF', 'dark');
      SystemNavigationBar.setNavigationBarContrastEnforced(true);
    }
  }, []);

  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/api/auth/signup", { fullName, email, password });
      console.log("✅ Signup success:", res.data);
      Alert.alert("Success", "Signup successful! You can now log in.");
      setFullName("");
      setEmail("");
      setPassword("");
      navigation.navigate("Login");
    } catch (error: any) {
      console.error("❌ Signup error:", error.response?.data || error.message);
      Alert.alert("Error", error.response?.data?.message || "Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>Join us to start your messaging journey</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Form Container */}
        <View style={styles.formContainer}>
          <View style={styles.formCard}>
            {/* Full Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                placeholder="Enter your full name"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                autoComplete="name"
                autoCapitalize="words"
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                placeholder="Enter your email"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                placeholder="Create a password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                style={styles.input}
                autoComplete="password-new"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[styles.signupButton, loading && styles.signupButtonDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Already have an account?</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Login Link */}
            <TouchableOpacity 
              style={styles.loginButton}
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.7}
            >
              <Text style={styles.loginButtonText}>Sign In to Your Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 80,
    paddingBottom: 50,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 10,
  },

  headerContent: {
    alignItems: "flex-start",
  },

  headerTitle: { 
    color: "#fff", 
    fontSize: 36,
    fontWeight: "800",
    fontFamily: "System",
    letterSpacing: -1,
    marginBottom: 8,
  },

  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "System",
    lineHeight: 22,
  },

  scrollContent: {
    flexGrow: 1,
  },

  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: -30,
  },

  formCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 30,
  },

  inputGroup: {
    marginBottom: 24,
  },

  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
    marginBottom: 8,
    fontFamily: "System",
    letterSpacing: -0.2,
  },

  input: {
    borderWidth: 2,
    borderColor: "#f1f5f9",
    borderRadius: 16,
    padding: 18,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "System",
    backgroundColor: "#f8fafc",
    color: COLORS.textDark,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  signupButton: {
    backgroundColor: COLORS.primary,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
    marginTop: 8,
    marginBottom: 32,
  },

  signupButtonDisabled: {
    opacity: 0.7,
  },

  signupButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "System",
    letterSpacing: 0.5,
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 32,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },

  dividerText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
    fontFamily: "System",
    marginHorizontal: 16,
  },

  loginButton: {
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },

  loginButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "System",
    letterSpacing: 0.3,
  },
});

export default SignupScreen;