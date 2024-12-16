import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import Button from '@/components/Button'; // Importing the Button component

const App = () => {
  const handleButtonPress = () => {
    Alert.alert('Button Pressed');
  };

  return (
    <View style={styles.container}>
      <Button label="Press Me" onPress={handleButtonPress} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;