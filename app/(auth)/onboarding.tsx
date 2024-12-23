import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";
import { onboardingSteps } from "../../constants";
import { router } from "expo-router";
import CustomButton from "../../components/CustomButton";

const Onboarding = () => {
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity
        onPress={() => router.replace("/(auth)/sign-up")}
        style={styles.skipButton}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Swiper Component */}
      <View style={styles.swiperContainer}>
        <Swiper
          ref={swiperRef}
          loop={false}
          dot={<View style={styles.dot} />}
          activeDot={<View style={styles.activeDot} />}
          onIndexChanged={(index) => setActiveIndex(index)}
        >
          {onboardingSteps.map((item) => (
            <View key={item.id} style={styles.slide}>
              <Image
                source={item.image}
                resizeMode="contain"
                style={{ width: "100%", height: 300 }}
              />
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          ))}
        </Swiper>
        <CustomButton
          title="Next"
          onPress={() => {}}
          IconLeft={null}
          IconRight={null}
          className="w-11/12 mt-10"
          bgVariant="primary"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  skipButton: {
    width: "100%",
    alignItems: "flex-end",
    padding: 15,
    fontWeight: "bold",
  },
  skipText: {
    fontSize: 16,
    color: "#0286ff",
    fontWeight: "bold",
  },
  swiperContainer: {
    height: "90%",
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: "#333", // You can adjust color here
  },
  dot: {
    width: 32,
    height: 4,
    marginHorizontal: 5,
    backgroundColor: "#e5e5e5",
    borderRadius: 2,
  },
  activeDot: {
    width: 32,
    height: 4,
    marginHorizontal: 5,
    backgroundColor: "#0286ff",
    borderRadius: 2,
  },
});

export default Onboarding;
