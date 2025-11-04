import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";
import { onboardingSteps } from "../../constants";
import { router } from "expo-router";
import CustomButton from "../../components/Button";
import { Colors } from "../../constants/color";

const Onboarding = () => {
  const swiperRef = useRef<any>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const isLastSlide = activeIndex === onboardingSteps.length - 1;

  const culturalInterests = [
    "🍜 Food & Cuisine",
    "🎨 Arts & Crafts",
    "🎵 Music & Dance",
    "📚 Literature",
    "🏺 Traditions",
    "👗 Fashion & Textiles",
    "🎭 Performing Arts",
    "🏛️ History",
  ];

  const categoryIcons = {
    Food: "🍜",
    Crafts: "🎨",
    Services: "💼",
    Events: "🎉",
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handleNext = () => {
    if (isLastSlide) {
      // Navigate to sign-up
      router.replace("/(auth)/sign-up");
    } else {
      swiperRef.current?.scrollBy(1);
    }
  };

  const renderSlideContent = (item: any) => {
    // Screen 2: Categories
    if (item.categories) {
      return (
        <View key={item.id} style={styles.slide}>
          <Image
            source={item.image}
            resizeMode="cover"
            style={styles.featureImage}
          />
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>

          {/* Category Icons */}
          <View style={styles.categoriesContainer}>
            {item.categories.map((category: string) => (
              <View key={category} style={styles.categoryItem}>
                <View style={styles.categoryIcon}>
                  <Text style={styles.categoryEmoji}>
                    {categoryIcons[category as keyof typeof categoryIcons]}
                  </Text>
                </View>
                <Text style={styles.categoryLabel}>{category}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    // Screen 3: Personalization
    if (item.isPersonalization) {
      return (
        <View key={item.id} style={styles.slide}>
          <Image
            source={item.image}
            resizeMode="cover"
            style={styles.communityImage}
          />
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.description}>{item.description}</Text>

          {/* Cultural Interests Selection */}
          <ScrollView
            style={styles.interestsScrollView}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.interestsContainer}>
              {culturalInterests.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    selectedInterests.includes(interest) &&
                      styles.interestChipSelected,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.interestText,
                      selectedInterests.includes(interest) &&
                        styles.interestTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.skipText}>You can always change this later</Text>
        </View>
      );
    }

    // Screen 1: Welcome
    return (
      <View key={item.id} style={styles.slide}>
        <Image
          source={item.image}
          resizeMode="cover"
          style={styles.welcomeImage}
        />
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity
        onPress={() => router.replace("/(auth)/sign-up")}
        style={styles.skipButton}
      >
        <Text style={styles.skipButtonText}>Skip</Text>
      </TouchableOpacity>

      {/* Swiper Component */}
      <Swiper
        ref={swiperRef}
        loop={false}
        dot={<View style={styles.dot} />}
        activeDot={<View style={styles.activeDot} />}
        onIndexChanged={(index) => setActiveIndex(index)}
        showsPagination={true}
        containerStyle={styles.swiperContainer}
      >
        {onboardingSteps.map((item) => renderSlideContent(item))}
      </Swiper>

      {/* Bottom Button */}
      <View style={styles.buttonContainer}>
        <CustomButton
          title={isLastSlide ? "Start Exploring" : "Next"}
          onPress={handleNext}
          style={{ width: "100%" }}
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
  },
  skipButtonText: {
    fontSize: 16,
    color: Colors.primary[500],
    fontWeight: "600",
  },
  swiperContainer: {
    flex: 1,
    width: "100%",
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    width: "100%",
  },
  slide: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  welcomeImage: {
    width: "100%",
    height: 280,
    borderRadius: 20,
    marginBottom: 30,
  },
  featureImage: {
    width: "100%",
    height: 240,
    borderRadius: 20,
    marginBottom: 25,
  },
  communityImage: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: Colors.secondary[900],
    width: "100%",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    color: Colors.secondary[700],
    lineHeight: 24,
    width: "100%",
  },
  categoriesContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 30,
    paddingHorizontal: 10,
  },
  categoryItem: {
    alignItems: "center",
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary[100],
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryLabel: {
    fontSize: 13,
    color: Colors.secondary[800],
    fontWeight: "500",
  },
  interestsScrollView: {
    width: "100%",
    maxHeight: 200,
    marginTop: 20,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 5,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.neutral[300],
    borderWidth: 1,
    borderColor: Colors.neutral[700],
  },
  interestChipSelected: {
    backgroundColor: Colors.primary[500],
    borderColor: Colors.primary[500],
  },
  interestText: {
    fontSize: 14,
    color: Colors.secondary[800],
    fontWeight: "500",
  },
  interestTextSelected: {
    color: "white",
    fontWeight: "600",
  },
  skipText: {
    fontSize: 13,
    color: Colors.secondary[600],
    marginTop: 15,
    textAlign: "center",
    fontStyle: "italic",
  },
  dot: {
    width: 32,
    height: 4,
    marginHorizontal: 5,
    backgroundColor: Colors.neutral[700],
    borderRadius: 2,
  },
  activeDot: {
    width: 32,
    height: 4,
    marginHorizontal: 5,
    backgroundColor: Colors.primary[500],
    borderRadius: 2,
  },
});

export default Onboarding;
