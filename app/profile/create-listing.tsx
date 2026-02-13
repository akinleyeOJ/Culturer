import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ListingForm from '../../components/ListingForm';

const CreateListingScreen = () => {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ListingForm
                headerTitle="New Listing"
                onClose={() => router.back()}
                onSuccess={() => router.back()}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFF' },
});

export default CreateListingScreen;
