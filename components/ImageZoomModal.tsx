import React from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Modal,
    Text,
} from 'react-native';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageZoomModalProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
}

export const ImageZoomModal = ({ visible, imageUri, onClose }: ImageZoomModalProps) => {
    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                    activeOpacity={0.8}
                >
                    <XMarkIcon size={24} color="#fff" />
                </TouchableOpacity>

                <ZoomableImage imageUri={imageUri} />
            </View>
        </Modal>
    );
};

const ZoomableImage = ({ imageUri }: { imageUri: string }) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const pinchGesture = Gesture.Pinch()
        .onUpdate((event) => {
            scale.value = savedScale.value * event.scale;
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else if (scale.value > 4) {
                scale.value = withSpring(4);
                savedScale.value = 4;
            } else {
                savedScale.value = scale.value;
            }
        });

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + event.translationX;
                translateY.value = savedTranslateY.value + event.translationY;
            }
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const doubleTapGesture = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1) {
                scale.value = withSpring(1);
                savedScale.value = 1;
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
            } else {
                scale.value = withSpring(2);
                savedScale.value = 2;
            }
        });

    const composedGesture = Gesture.Race(
        doubleTapGesture,
        Gesture.Simultaneous(pinchGesture, panGesture)
    );

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value },
        ],
    }));

    return (
        <View style={styles.imageContainer}>
            <GestureDetector gesture={composedGesture}>
                <Animated.Image
                    source={{ uri: imageUri }}
                    style={[styles.fullScreenImage, animatedStyle]}
                    resizeMode="contain"
                />
            </GestureDetector>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.8,
    },
});
