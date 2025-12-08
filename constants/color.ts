// /src/constants/colors.ts

//............................
// to use color constants, import the color.ts file and use the color constants like this:
// import { Colors } from "../constants/color";
// backgroundColor: Colors.primary[100],
//............................

type ColorShades = {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export type ColorsType = {
  primary: ColorShades;
  secondary: ColorShades;
  success: ColorShades;
  danger: ColorShades;
  warning: ColorShades;
  neutral: ColorShades;
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
};

export const Colors: ColorsType = {
  // Coral/Orange - Primary brand color (from buttons and accents)
  primary: {
    50: "#FFF9F6",
    100: "#FFF5F0",
    200: "#FFE5D9",
    300: "#FFC9B3",
    400: "#FFAC8C",
    500: "#FF8F66", // Main coral/orange
    600: "#FF7A52",
    700: "#F25C2E",
    800: "#CC4A1F",
    900: "#993715",
  },
  // Pink/Rose - Secondary accent color
  secondary: {
    50: "#FFFAFC",
    100: "#FFF0F5",
    200: "#FFE0EC",
    300: "#FFC2D9",
    400: "#FFA3C7",
    500: "#FF85B5", // Main pink
    600: "#FF6BA3",
    700: "#E5507A",
    800: "#B83D5F",
    900: "#8C2E47",
  },
  // Green - For success states and positive indicators
  success: {
    50: "#F2FCF7",
    100: "#E8FAF0",
    200: "#C6F2DC",
    300: "#8FE6BA",
    400: "#58DA98",
    500: "#0CC25F", // Bright green (from "Free shipping" badge)
    600: "#0AAA51",
    700: "#088A42",
    800: "#066D34",
    900: "#045025",
  },
  // Red - For errors and "out of stock" indicators
  danger: {
    50: "#FFFAFA",
    100: "#FFF0F0",
    200: "#FFE0E0",
    300: "#FFB8B8",
    400: "#FF9090",
    500: "#FF6868",
    600: "#FF4040",
    700: "#E02020",
    800: "#B81818",
    900: "#901010",
  },
  // Orange/Amber - For warnings and time badges
  warning: {
    50: "#FFFCF0",
    100: "#FFF8E6",
    200: "#FFEEB3",
    300: "#FFE180",
    400: "#FFD44D",
    500: "#FFC61A",
    600: "#F0B400",
    700: "#CC9900",
    800: "#997300",
    900: "#664D00",
  },
  // Neutral/Gray - For text and borders
  neutral: {
    50: "#FAFAFA",
    100: "#F9F9F9",
    200: "#F0F0F0",
    300: "#E0E0E0",
    400: "#C4C4C4",
    500: "#A0A0A0",
    600: "#757575",
    700: "#525252",
    800: "#3D3D3D",
    900: "#1F1F1F",
  },
  // Background colors
  background: {
    primary: "#FFFFFF",
    secondary: "#FFF8F5", // Cream/warm white
    tertiary: "#F9F9F9",
  },
  // Text colors
  text: {
    primary: "#1F1F1F",
    secondary: "#525252",
    tertiary: "#A0A0A0",
  },
};
