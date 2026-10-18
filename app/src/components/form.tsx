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

import { PressScale } from '@/components/press-scale';
import { T, radius } from '@/constants/trajectory';

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={T.placeholder} style={styles.input} {...input} />
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
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.button, buttonStyles[variant], flex && styles.flex, (disabled || loading) && styles.disabled]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? T.onAccent : T.ink} />
      ) : (
        <Text style={[styles.buttonText, buttonTextStyles[variant]]}>{title}</Text>
      )}
    </PressScale>
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
              accessibilityState={{ checked: on }}
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

/** A dropdown: tap to show the options in a list below, tap one to pick it. */
export function Select<V extends string>({
  label,
  options,
  value,
  onChange,
  placeholder = 'Choose…',
}: {
  label?: string;
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={[styles.input, styles.select, open && styles.selectOpen]}>
        <Text style={[styles.selectText, !selected && styles.selectPlaceholder]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.selectChevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.selectList} accessibilityRole="list">
          {options.map((o) => {
            const on = o.value === value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.selectOption, on && styles.selectOptionOn, pressed && styles.pressed]}>
                <Text style={[styles.selectOptionText, on && styles.selectOptionTextOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
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
    borderColor: T.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    fontSize: 16,
    color: T.ink,
    backgroundColor: T.surface,
  },
  button: { minHeight: 48, borderRadius: 999, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
  segmented: { flexDirection: 'row', gap: 4, backgroundColor: T.elevated, borderRadius: radius.md, padding: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentOn: { backgroundColor: T.lineStrong },
  segmentText: { fontSize: 14, fontWeight: '600', color: T.muted },
  segmentTextOn: { color: T.ink },
  error: { fontSize: 14, lineHeight: 20, color: T.urgent },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectOpen: { borderColor: T.accent },
  selectText: { flex: 1, fontSize: 16, color: T.ink },
  selectPlaceholder: { color: T.placeholder },
  selectChevron: { fontSize: 14, color: T.muted },
  selectList: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line, borderRadius: radius.md, padding: 4 },
  selectOption: { minHeight: 44, borderRadius: 9, paddingHorizontal: 12, justifyContent: 'center' },
  selectOptionOn: { backgroundColor: T.accentSoft },
  selectOptionText: { fontSize: 15, color: T.ink },
  selectOptionTextOn: { fontWeight: '600', color: T.accentDark },
});

const buttonStyles = StyleSheet.create({
  primary: { backgroundColor: T.accent },
  secondary: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
  danger: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.dangerLine },
  ghost: { backgroundColor: 'transparent' },
});

const buttonTextStyles = StyleSheet.create({
  primary: { color: T.onAccent },
  secondary: { color: T.ink },
  danger: { color: T.urgent },
  ghost: { color: T.muted, fontWeight: '500' },
});
