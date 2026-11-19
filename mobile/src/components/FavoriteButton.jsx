import { Pressable, StyleSheet, Text } from 'react-native';

/**
 * Heart toggle for saving a spot to favorites.
 * @param {{ favorited: boolean, onToggle: () => void, disabled?: boolean }} props
 */
export default function FavoriteButton({ favorited, onToggle, disabled }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={favorited ? 'Remove from favorites' : 'Save to favorites'}
      accessibilityState={{ selected: favorited, disabled: !!disabled }}
      onPress={onToggle}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [styles.button, favorited && styles.active, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[styles.icon, favorited && styles.activeText]}>{favorited ? '♥' : '♡'}</Text>
      <Text style={[styles.text, favorited && styles.activeText]}>{favorited ? 'Saved' : 'Save'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#d64561', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14,
  },
  active: { backgroundColor: '#d64561' },
  icon: { fontSize: 18, color: '#d64561' },
  text: { fontSize: 15, fontWeight: '600', color: '#d64561' },
  activeText: { color: 'white' },
});
