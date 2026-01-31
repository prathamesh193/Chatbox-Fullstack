// src/components/ProfilePicture.tsx
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface ProfilePictureProps {
  uri?: string;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
  showBorder?: boolean;
}

const ProfilePicture: React.FC<ProfilePictureProps> = ({
  uri,
  size = 52,
  borderColor = 'rgba(255, 255, 255, 0.8)',
  borderWidth = 2,
  showBorder = false,
}) => {
  const defaultAvatar = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
  
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Image
        source={{ uri: uri || defaultAvatar }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            ...(showBorder && {
              borderWidth: borderWidth,
              borderColor: borderColor,
            }),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#f1f5f9',
  },
});

export default ProfilePicture;