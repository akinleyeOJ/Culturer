import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Modal,
    Text,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageZoomModalProps {
    visible: boolean;
    images: string[];
    initialIndex?: number;
    onClose: () => void;
}

export const ImageZoomModal = ({
    visible,
    images,
    initialIndex = 0,
    onClose
}: ImageZoomModalProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const scrollRef = React.useRef<ScrollView>(null);
    const [scrollEnabled, setScrollEnabled] = useState(true);

    useEffect(() => {
        if (visible) {
            setCurrentIndex(initialIndex);
            setScrollEnabled(true);
        }
    }, [visible, initialIndex]);

    if (!images || images.length === 0) return null;

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const contentOffset = event.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffset / SCREEN_WIDTH);
        if (index !== currentIndex && index >= 0 && index < images.length) {
            setCurrentIndex(index);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header with Close Button and Page Indicator */}
                <View style={styles.header}>
                    <View style={styles.pageIndicator}>
                        <Text style={styles.pageText}>
                            {currentIndex + 1} / {images.length}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <XMarkIcon size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    ref={scrollRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentOffset={{ x: initialIndex * SCREEN_WIDTH, y: 0 }}
                    scrollEnabled={scrollEnabled}
                    decelerationRate="fast"
                >
                    {images.map((uri, index) => (
                        <ZoomableImage
                            key={`${uri}-${index}`}
                            imageUri={uri}
                            onZoomChange={setScrollEnabled}
                        />
                    ))}
                </ScrollView>
            </View>
        </Modal>
    );
};

interface ZoomableImageProps {
    imageUri: string;
    onZoomChange: (scrollEnabled: boolean) => void;
}

const ZoomableImage = ({ imageUri, onZoomChange }: ZoomableImageProps) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const updateScrollEnabled = (enabled: boolean) => {
        onZoomChange(enabled);
    };

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
                runOnJS(updateScrollEnabled)(true);
            } else if (scale.value > 4) {
                scale.value = withSpring(4);
                savedScale.value = 4;
                runOnJS(updateScrollEnabled)(false);
            } else {
                savedScale.value = scale.value;
                if (scale.value > 1.1) {
                    runOnJS(updateScrollEnabled)(false);
                } else {
                    runOnJS(updateScrollEnabled)(true);
                }
            }
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
                runOnJS(updateScrollEnabled)(true);
            } else {
                scale.value = withSpring(2.5);
                savedScale.value = 2.5;
                runOnJS(updateScrollEnabled)(false);
            }
        });

    // Don't add pan to the gesture - it interferes with ScrollView
    // User can pinch to zoom, then drag. Or double-tap to zoom.
    const composedGesture = Gesture.Exclusive(
        doubleTapGesture,
        pinchGesture
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
        backgroundColor: 'rgba(0, 0, 0, 0.98)',
        justifyContent: 'center',
    },
    header: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageIndicator: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    pageText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.85,
    },
});
