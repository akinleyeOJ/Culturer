import React from "react";
import { View, StyleSheet, Alert, Text } from "react-native";

const Profile = () => {
  const handleButtonPress = () => {
    Alert.alert("Button Pressed");
  };

  return (
    <View style={styles.container}>
      <Text>Profile</Text>
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

export default Profile;
