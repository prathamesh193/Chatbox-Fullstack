import React from "react";
import { View, ActivityIndicator } from "react-native";
import { COLORS } from "../constants/colors";

export default function Loader() {
    return (
        <View style={{
            flex: 1, justifyContent: "center", alignItems: "center",
            backgroundColor: COLORS.background
        }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
    );
}
