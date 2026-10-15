import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** @param {{ title: string, subtitle?: string, children: import('react').ReactNode }} props */
export default function Screen({ title, subtitle, children }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>STUDYSCOTTY / UCR</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 24, gap: 18 },
  brand: { color: '#2463a0', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { fontSize: 32, fontWeight: '700', color: '#142d4e' },
  subtitle: { fontSize: 16, color: '#526277', lineHeight: 24 },
});
