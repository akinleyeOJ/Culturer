// app/index.tsx
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../contexts/AuthContext";


const Index = () => {
  // Comment this out when you're done working on Home
  return <Redirect href="/(tabs)/Home" />;
};
// const Index = () => {
//   const { user, loading } = useAuth();
//   const [isReady, setIsReady] = useState(false);

//   useEffect(() => {
//     // Small delay to ensure auth state is loaded
//     const timer = setTimeout(() => {
//       setIsReady(true);
//     }, 500);

//     return () => clearTimeout(timer);
//   }, []);

//   if (loading || !isReady) {
//     return (
//       <View style={styles.container}>
//         <ActivityIndicator size="large" color="#FF8F66" />
//       </View>
//     );
//   }

//   // If user is logged in, go to Home, otherwise go to auth
//   if (user) {
//     return <Redirect href="/(tabs)/Home" />;
//   }

//   return <Redirect href="/(auth)/auth" />;
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     backgroundColor: "#fff",
//   },
// });

export default Index;
