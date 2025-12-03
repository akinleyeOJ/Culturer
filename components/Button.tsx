import { ButtonProps } from "../types/type";
import { StyleSheet, TouchableOpacity, Text, ViewStyle } from "react-native";
import { Colors } from "../constants/color";

const CustomButton = ({
  title,
  onPress,
  bgVariant = "primary",
  textVariant = "default",
  IconLeft,
  IconRight,
  style,
  ...props
}: ButtonProps) => {
  // Choose background variant dynamically
  const getBgStyle = () => {
    switch (bgVariant) {
      case "secondary":
        return styles.bgSecondary;
      case "danger":
        return styles.bgDanger;
      case "outline":
        return styles.bgOutline;
      case "success":
        return styles.bgSuccess;
      default:
        return styles.bgPrimary;
    }
  };

  const getTextStyle = () => {
    switch (textVariant) {
      case "secondary":
        return styles.textSecondary;
      case "danger":
        return styles.textDanger;
      case "success":
        return styles.textSuccess;
      default:
        return styles.textDefault;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, getBgStyle(), style]}
      {...props}
    >
      {IconLeft && <IconLeft />}
      <Text style={[styles.text, getTextStyle()]}>{title}</Text>
      {IconRight && <IconRight />}
    </TouchableOpacity>
  );
};

export default CustomButton;

const styles = StyleSheet.create({
  button: {
    borderRadius: 12, // for rounded-full
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)", // shadow-md equivalent, use specific packages or custom shadow if needed
    padding: 12, // Example padding
    gap: 8
  },
  // Add other specific styles based on your background variant and className
  // Example for different background variants:
  bgPrimary: {
    backgroundColor: Colors.primary[500], // Coral/orange - app's primary color
  },
  bgSecondary: {
    backgroundColor: "#6B7280", // gray-500
  },
  bgDanger: {
    backgroundColor: "#ee2424ff", // red-500
  },
  bgOutline: {
    backgroundColor: "transparent",
    borderColor: "#D1D5DB", // Neutral color for border
    borderWidth: 0.5,
  },
  bgSuccess: {
    backgroundColor: "#10B981", // green-500
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
  },
  textSecondary: {
    color: "#6B7280", // gray-500
  },
  textDanger: {
    color: "#ee2424ff", // red-500
  },
  textSuccess: {
    color: "#10B981", // green-500
  },
  textDefault: {
    color: "#FFFFFF", // white
  }

});
