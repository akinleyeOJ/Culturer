import React from "react";
import { View, StyleSheet, Alert, Text } from "react-native";

const App = () => {
  const handleButtonPress = () => {
    Alert.alert("Button Pressed");
  };

  return (
    <View style={styles.container}>
      <Text>tesstt</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default App;
