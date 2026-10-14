import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { T } from '@/constants/trajectory';

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9AA0AA" style={styles.input} {...input} />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  flex?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, flex }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyles[variant],
        flex && styles.flex,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : T.ink} />
      ) : (
        <Text style={[styles.buttonText, buttonTextStyles[variant]]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** A "Delete" button that needs a second tap, so it works the same on phone and web. */
export function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title={armed ? 'Tap again to delete' : label}
      variant="danger"
      loading={busy}
      onPress={async () => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
          return;
        }
        setBusy(true);
        try {
          await onConfirm();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segmented} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(o.value)}
              style={[styles.segment, on && styles.segmentOn]}>
              <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: T.ink },
  hint: { fontSize: 12, color: T.muted },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#C9CDD4',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: T.ink,
    backgroundColor: T.surface,
  },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  segmented: { flexDirection: 'row', gap: 4, backgroundColor: '#E4E6EA', borderRadius: 12, padding: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentOn: { backgroundColor: T.surface },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#4A4F59' },
  segmentTextOn: { color: T.ink },
  error: { fontSize: 14, lineHeight: 20, color: T.urgent },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: T.accent },
  secondary: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
  danger: { backgroundColor: T.surface, borderWidth: 1, borderColor: '#F1C2BD' },
  ghost: { backgroundColor: 'transparent' },
});

const buttonTextStyles = StyleSheet.create({
  primary: { color: '#FFFFFF' },
  secondary: { color: T.ink },
  danger: { color: T.urgent },
  ghost: { color: T.muted, fontWeight: '500' },
});
