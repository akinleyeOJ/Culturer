import React, { ReactNode } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleProp,
    StyleSheet,
    ViewStyle,
} from 'react-native';

interface KeyboardAwareBottomSheetProps {
    children: ReactNode;
    contentContainerStyle?: StyleProp<ViewStyle>;
    keyboardVerticalOffset?: number;
}

export default function KeyboardAwareBottomSheet({
    children,
    contentContainerStyle,
    keyboardVerticalOffset = 24,
}: KeyboardAwareBottomSheetProps) {
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={keyboardVerticalOffset}
            style={styles.keyboardContainer}
            pointerEvents="box-none"
        >
            <Pressable style={styles.sheetWrapper} onPress={(event) => event.stopPropagation()}>
                <ScrollView
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerStyle={contentContainerStyle}
                    showsVerticalScrollIndicator={false}
                >
                    {children}
                </ScrollView>
            </Pressable>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardContainer: {
        width: '100%',
        justifyContent: 'flex-end',
    },
    sheetWrapper: {
        width: '100%',
    },
});
