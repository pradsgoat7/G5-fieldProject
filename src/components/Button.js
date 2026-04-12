import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const Button = ({ title, onPress, style, textStyle, disabled = false, type = 'primary' }) => {
  const isSecondary = type === 'secondary';
  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        isSecondary && styles.secondaryButton,
        disabled && styles.disabledButton,
        style
      ]} 
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[
        styles.text, 
        isSecondary && styles.secondaryText,
        disabled && styles.disabledText,
        textStyle
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryText: {
    color: colors.primary,
  },
  disabledText: {
    color: '#9E9E9E',
  }
});

export default Button;
