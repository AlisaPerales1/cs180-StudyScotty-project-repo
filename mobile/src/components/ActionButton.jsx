import { Pressable, StyleSheet, Text } from 'react-native';

/** @param {{ title: string, onPress: () => void, disabled?: boolean, variant?: 'primary' | 'secondary' }} props */
export default function ActionButton({ title, onPress, disabled, variant = 'primary' }) {
  const secondary = variant === 'secondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#2463a0', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center' },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2463a0' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  buttonTextSecondary: { color: '#2463a0' },
});
