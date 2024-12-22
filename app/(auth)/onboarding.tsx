import { router } from "expo-router";
import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";
import { onboardingSteps } from "@/constants";

const Onboarding = () => {
  const swiperRef = useRef<Swiper>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { height } = Dimensions.get("window");

  return (
    <SafeAreaView className="flex-1 bg-white">
      <TouchableOpacity
        onPress={() => router.replace("/(auth)/sign-up")}
        className="w-full items-end p-5"
      >
        <Text className="text-black text-md">Skip</Text>
      </TouchableOpacity>

      <View style={{ height: height * 0.7 }}>
        <Swiper
          ref={swiperRef}
          loop={false}
          dot={
            <View className="w-[32px] h-[4px] mx-1 bg-primary-200 rounded-full" />
          }
          activeDot={
            <View className="w-[32px] h-[4px] mx-1 bg-primary-500 rounded-full" />
          }
          onIndexChanged={(index) => setActiveIndex(index)}
        >
          {onboardingSteps.map((item) => (
            <View
              key={item.id}
              className="flex-1 items-center justify-center px-4"
            >
              <Text className="text-2xl font-bold text-center">
                {item.title}
              </Text>
              <Text className="text-center mt-2">{item.description}</Text>
            </View>
          ))}
        </Swiper>
      </View>
    </SafeAreaView>
  );
};

export default Onboarding;
