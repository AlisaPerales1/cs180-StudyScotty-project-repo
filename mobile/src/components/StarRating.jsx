import { Pressable, StyleSheet, Text, View } from 'react-native';

const STARS = [1, 2, 3, 4, 5];
const FILLED = '#f2a900';
const EMPTY = '#cfd8e3';

/**
 * Displays a 1–5 star rating, or lets the user pick one when onChange is set.
 * @param {{ value: number, onChange?: (rating: number) => void, size?: number }} props
 */
export default function StarRating({ value, onChange, size = 18 }) {
  const rounded = Math.round(value);

  if (!onChange) {
    return (
      <Text
        accessibilityRole="image"
        accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}
        style={{ fontSize: size, letterSpacing: 2 }}
      >
        {STARS.map((star) => (
          <Text key={star} style={{ color: star <= rounded ? FILLED : EMPTY }}>★</Text>
        ))}
      </Text>
    );
  }

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Rating" style={styles.row}>
      {STARS.map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`}
          accessibilityState={{ checked: star === value }}
          onPress={() => onChange(star)}
          hitSlop={6}
        >
          <Text style={{ fontSize: size, color: star <= value ? FILLED : EMPTY }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
});
