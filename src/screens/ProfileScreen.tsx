// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    StyleSheet,
    SafeAreaView,
    Platform,
    StatusBar,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { api } from '../utils/api';

const ProfileScreen = () => {
    const navigation = useNavigation<any>();

    const [profilePic, setProfilePic] = useState('');
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingProfile, setFetchingProfile] = useState(true);

    useEffect(() => {
        fetchMyProfile();
    }, []);

    const fetchMyProfile = async () => {
        try {
            setFetchingProfile(true);
            const token = await AsyncStorage.getItem('token');

            if (!token) {
                Alert.alert('Error', 'Please login again');
                navigation.navigate('Login');
                return;
            }

            const response = await api.get('/api/profile/me');
            console.log('Profile data:', response.data);

            if (response.data.success && response.data.user) {
                const user = response.data.user;
                setUserName(user.fullName || '');
                setUserEmail(user.email || '');

                // Fix localhost URL
                const pic = user.profilePic || '';
                setProfilePic(pic.replace('http://localhost:3000', 'http://139.59.87.161:3000'));
            }
        } catch (error: any) {
            console.error('Failed to fetch profile:', error);
            Alert.alert('Error', 'Failed to load profile');
        } finally {
            setFetchingProfile(false);
        }
    };

    const uploadProfilePicture = async (imageUri: string, retryCount = 0) => {
        try {
            setLoading(true);

            const token = await AsyncStorage.getItem('token');
            if (!token) {
                Alert.alert('Error', 'Please login again');
                return;
            }

            // Detect file type
            const fileName = imageUri.split('/').pop() || 'profile.jpg';
            const fileExtension = fileName.toLowerCase().split('.').pop() || 'jpg';
            const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

            const formData = new FormData();
            formData.append('profilePicture', {
                uri: imageUri,
                type: mimeType,
                name: fileName,
            } as any);

            const response = await fetch('http://139.59.87.161:3000/api/profile/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
                body: formData,
            });

            const data = await response.json();
            console.log('Upload response:', data);

            if (data.success && data.user) {
                const pic = data.user.profilePic || '';
                setProfilePic(pic.replace('http://localhost:3000', 'http://139.59.87.161:3000'));
                Alert.alert('Success', 'Profile picture updated successfully!');
            } else {
                Alert.alert('Error', data.message || 'Failed to upload profile picture');
            }
        } catch (error: any) {
            console.error('Upload error:', error);

            if (retryCount < 1) {
                console.log('Retrying upload...');
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                return uploadProfilePicture(imageUri, retryCount + 1);
            }
            Alert.alert('Error', 'Failed to upload. Please check your internet connection and try again.');
        } finally {
            setLoading(false);
        }
    };

    const removeProfilePicture = async () => {
        Alert.alert(
            'Remove Profile Picture',
            'Are you sure you want to remove your profile picture?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);

                            const token = await AsyncStorage.getItem('token');
                            if (!token) {
                                Alert.alert('Error', 'Please login again');
                                return;
                            }

                            const response = await api.delete('/api/profile/remove');
                            console.log('Remove response:', response.data);

                            if (response.data.success) {
                                setProfilePic('');
                                Alert.alert('Success', 'Profile picture removed successfully!');
                            } else {
                                Alert.alert('Error', response.data.message || 'Failed to remove profile picture');
                            }
                        } catch (error: any) {
                            console.error('Remove error:', error);
                            Alert.alert('Error', 'Failed to remove profile picture');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const pickImage = async () => {
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                quality: 0.8,
                maxWidth: 1000,
                maxHeight: 1000,
                includeBase64: false,
                selectionLimit: 1,
            });
            if (result.didCancel) {
                return;
            }
            if (result.errorCode) {
                Alert.alert('Error', result.errorMessage || 'Failed to pick image');
                return;
            }
            if (result.assets && result.assets.length > 0) {
                const image = result.assets[0];

                console.log('Selected image:', {
                    uri: image.uri,
                    fileName: image.fileName,
                    fileSize: image.fileSize,
                    type: image.type,
                });

                const uri = image.uri || '';
                if (!uri) {
                    Alert.alert('Error', 'Invalid image selected');
                    return;
                }

                const fileName = image.fileName || uri.split('/').pop() || '';
                const fileExtension = fileName.toLowerCase().split('.').pop() || '';

                console.log('File extension:', fileExtension);

                if (fileExtension !== 'jpg' && fileExtension !== 'jpeg' && fileExtension !== 'png') {
                    Alert.alert('Error', 'Only JPG and PNG images are allowed');
                    return;
                }
                if (image.fileSize && image.fileSize > 2 * 1024 * 1024) {
                    Alert.alert('Error', 'Image must be less than 2MB');
                    return;
                }
                await uploadProfilePicture(uri);
            }
        } catch (error: any) {
            console.error('Image picker error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const showProfileOptions = () => {
        Alert.alert(
            'Profile Picture',
            'Choose an option',
            [
                { text: 'Change Picture', onPress: pickImage },
                { text: 'Remove Picture', onPress: removeProfilePicture, style: 'destructive' },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    if (fetchingProfile) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Loading profile...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
                <View style={styles.backButton} />
            </View>

            <View style={styles.content}>

                <View style={styles.profileSection}>
                    <TouchableOpacity
                        style={styles.imageContainer}
                        onPress={showProfileOptions}
                        disabled={loading}
                    >
                        {loading ? (
                            <View style={styles.profileImageWrapper}>
                                <ActivityIndicator size="large" color={COLORS.primary} />
                            </View>
                        ) : (
                            <>
                                <Image
                                    source={{
                                        uri: profilePic || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
                                    }}
                                    style={styles.profileImage}
                                />
                                <View style={styles.editBadge}>
                                    <Text style={styles.editIcon}>📷</Text>
                                </View>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.editHint}>Tap to change profile picture</Text>
                </View>

                <View style={styles.infoSection}>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>Name</Text>
                        <Text style={styles.infoValue}>{userName || 'Not set'}</Text>
                    </View>

                    <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>Email</Text>
                        <Text style={styles.infoValue}>{userEmail || 'Not set'}</Text>
                    </View>
                </View>

                <View style={styles.buttonSection}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={pickImage}
                        disabled={loading}
                    >
                        <Text style={styles.primaryButtonText}>
                            {profilePic ? 'Change Profile Picture' : 'Add Profile Picture'}
                        </Text>
                    </TouchableOpacity>

                    {profilePic ? (
                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={removeProfilePicture}
                            disabled={loading}
                        >
                            <Text style={styles.secondaryButtonText}>Remove Profile Picture</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={styles.infoTextContainer}>
                    <Text style={styles.infoText}>• Only JPG and PNG images are allowed</Text>
                    <Text style={styles.infoText}>• Maximum file size: 2MB</Text>
                    <Text style={styles.infoText}>• Your profile picture will be visible to all users</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#64748b',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        fontSize: 28,
        color: COLORS.primary,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textDark,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    profileSection: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    imageContainer: {
        position: 'relative',
    },
    profileImageWrapper: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImage: {
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 4,
        borderColor: COLORS.primary,
    },
    editBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#fff',
    },
    editIcon: {
        fontSize: 20,
    },
    editHint: {
        marginTop: 16,
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    infoSection: {
        marginTop: 20,
    },
    infoCard: {
        backgroundColor: '#f8fafc',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    infoLabel: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 16,
        color: COLORS.textDark,
        fontWeight: '600',
    },
    buttonSection: {
        marginTop: 30,
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#dc2626',
    },
    secondaryButtonText: {
        color: '#dc2626',
        fontSize: 16,
        fontWeight: '700',
    },
    infoTextContainer: {
        marginTop: 30,
        paddingHorizontal: 10,
    },
    infoText: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 8,
        lineHeight: 20,
    },
});

export default ProfileScreen;