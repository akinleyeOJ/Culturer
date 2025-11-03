import onboarding1 from "../assets/images/one.jpeg";
import onboarding2 from "../assets/images/two.jpg";
import onboarding3 from "../assets/images/three.jpg";

export const images = {
  onboarding1,
  onboarding2,
  onboarding3,
};
export const onboardingSteps = [
  {
    id: 1,
    title: "Discover the World Through Culture",
    description:
      "Connect with authentic traditions, flavors, and crafts from communities around the globe",
    image: images.onboarding1,
  },
  {
    id: 2,
    title: "Buy, Sell & Share Cultural Treasures",
    description:
      "From handcrafted goods to traditional recipes and cultural experiences",
    image: images.onboarding2,
    categories: ["Food", "Crafts", "Services", "Events"],
  },
  {
    id: 3,
    title: "Your Cultural Journey Starts Here",
    description:
      "Tell us about your heritage and interests to discover your community",
    image: images.onboarding3,
    isPersonalization: true,
  },
];
