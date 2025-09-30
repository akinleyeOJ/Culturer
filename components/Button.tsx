import { ButtonProps } from "../types/type";
import { StyleSheet, TouchableOpacity, Text, ViewStyle } from "react-native";

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
  let bgStyle = styles.bgPrimary;
  if (bgVariant === "secondary") bgStyle = styles.bgSecondary;
  else if (bgVariant === "danger") bgStyle = styles.bgDanger;
  else if (bgVariant === "outline") bgStyle = styles.bgOutline;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, bgStyle, style]}
      {...props}
    >
      {IconLeft && <IconLeft />}
      <Text style={styles.text}>{title}</Text>
      {IconRight && <IconRight />}
    </TouchableOpacity>
  );
};

export default CustomButton;

const styles = StyleSheet.create({
  button: {
    width: "100%",
    borderRadius: 9999, // for rounded-full
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)", // shadow-md equivalent, use specific packages or custom shadow if needed
    padding: 12, // Example padding
  },
  text: {
    fontSize: 16,
    fontWeight: "bold",
  },
  // Add other specific styles based on your background variant and className
  // Example for different background variants:
  bgPrimary: {
    backgroundColor: "#0286ff", // Blue variant as default
  },
  bgSecondary: {
    backgroundColor: "#6B7280", // gray-500
  },
  bgDanger: {
    backgroundColor: "#EF4444", // red-500
  },
  bgOutline: {
    backgroundColor: "transparent",
    borderColor: "#D1D5DB", // Neutral color for border
    borderWidth: 0.5,
  },
});
