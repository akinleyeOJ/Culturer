import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

// Define props for the Button component
interface ButtonProps {
  label: string;
  onPress: () => void;
  style?: object; // Optional style prop to customize the button
}

const Button: React.FC<ButtonProps> = ({ label, onPress, style }) => {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Button;
