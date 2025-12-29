import React from "react";
import { View, Text } from "react-native";
import { COLORS } from "../constants/colors";

export default function MessageBubble({ message, isMine }: any) {
    return (
        <View
            style={{
                backgroundColor: isMine ? COLORS.primary : COLORS.lightGray,
                alignSelf: isMine ? "flex-end" : "flex-start",
                borderRadius: 15,
                padding: 10,
                marginVertical: 5,
                maxWidth: "80%",
            }}
        >
            <Text style={{ color: isMine ? COLORS.background : COLORS.text }}>
                {message}
            </Text>
        </View>
    );
}
