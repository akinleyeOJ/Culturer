import React, { useState } from 'react';
import {
    View,
    Image,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ScrollView,
    Text,
} from 'react-native';
import { Colors } from '../constants/color';
import { ImageZoomModal } from './ImageZoomModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = SCREEN_WIDTH * 0.9;

interface ImageCarouselProps {
    images: string[];
    emoji?: string;
}

export const ImageCarousel = ({ images, emoji }: ImageCarouselProps) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [fullScreenVisible, setFullScreenVisible] = useState(false);

    const handleScroll = (event: any) => {
        const scrollPosition = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollPosition / SCREEN_WIDTH);
        setActiveIndex(index);
    };

    const openFullScreen = () => {
        setFullScreenVisible(true);
    };

    const closeFullScreen = () => {
        setFullScreenVisible(false);
    };

    // If no images, show emoji placeholder
    if (!images || images.length === 0) {
        return (
            <View style={[styles.container, styles.placeholderContainer]}>
                <Text style={styles.placeholderEmoji}>{emoji || '🎨'}</Text>
            </View>
        );
    }

    return (
        <>
            <View style={styles.container}>
                <ScrollView
                    horizontal
                    pagingEnabled
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    decelerationRate="fast"
                >
                    {images.map((image, index) => (
                        <TouchableOpacity
                            key={index}
                            activeOpacity={0.9}
                            onPress={openFullScreen}
                        >
                            <Image
                                source={{ uri: image }}
                                style={styles.image}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Pagination Dots */}
                {images.length > 1 && (
                    <View style={styles.pagination}>
                        {images.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    index === activeIndex && styles.activeDot,
                                ]}
                            />
                        ))}
                    </View>
                )}
            </View>

            <ImageZoomModal
                visible={fullScreenVisible}
                images={images}
                initialIndex={activeIndex}
                onClose={closeFullScreen}
            />
        </>
    );
};



const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: CAROUSEL_HEIGHT,
        backgroundColor: Colors.neutral[100],
    },
    placeholderContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary[100],
    },
    placeholderEmoji: {
        fontSize: 120,
    },
    image: {
        width: SCREEN_WIDTH,
        height: CAROUSEL_HEIGHT,
    },
    pagination: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    activeDot: {
        backgroundColor: '#fff',
        width: 24,
    },
});
