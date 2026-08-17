import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCafeState } from '../hooks/useCafeState';
import {
  dailyPearlTotal,
  HABIT_TIERS,
  HabitTier,
  pearlsForRep,
  TIER_ORDER,
} from '../constants/habitTiers';

export default function HabitFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, addHabit, updateHabit, removeHabit } = useCafeState();
  const insets = useSafeAreaInsets();

  const existing = useMemo(
    () => (id ? state.habits.find((habit) => habit.id === id) : undefined),
    [id, state.habits]
  );
  const isEditing = !!existing;

  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [tier, setTier] = useState<HabitTier>(existing?.tier ?? 'anchor');
  const [timesPerDay, setTimesPerDay] = useState(
    existing?.timesPerDay ?? HABIT_TIERS.anchor.defaultTimesPerDay
  );
  const [reminderText, setReminderText] = useState(existing?.reminderText ?? '');

  const tierDef = HABIT_TIERS[tier];
  const canSave = !!name.trim();

  const handleTierChange = (nextTier: HabitTier) => {
    setTier(nextTier);
    // Clamp the cap into the new tier's allowed range so switching to
    // Keystone can't leave a habit sitting at 6 reps a day.
    setTimesPerDay((prev) =>
      Math.min(Math.max(1, prev), HABIT_TIERS[nextTier].maxTimesPerDay)
    );
  };

  const handleSave = () => {
    if (!canSave) {
      Alert.alert('Name required', 'Give this habit a name first.');
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      tier,
      timesPerDay,
      reminderEnabled: !!reminderText.trim(),
      reminderText: reminderText.trim(),
    };

    if (isEditing && existing) {
      updateHabit(existing.id, payload);
    } else {
      addHabit(payload);
    }

    router.back();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Delete habit', `Remove "${existing.name}" and its history?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeHabit(existing.id);
          router.back();
        },
      },
    ]);
  };

  const maxTimes = tierDef.maxTimesPerDay;

  return (
    // The name and description fields are the first thing this screen asks
    // for, so the form has to stay above the keyboard the whole time.
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backPill, pressed && styles.pressed]}
        >
          <Text style={styles.backPillText}>Cancel</Text>
        </Pressable>

        <Text style={styles.topTitle}>{isEditing ? 'Edit habit' : 'New habit'}</Text>

        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.card}>
          <Text style={styles.label}>What is it?</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Go to the gym"
            placeholderTextColor="#9A8D95"
            style={styles.input}
            autoFocus={!isEditing}
          />

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Why it matters (optional)"
            placeholderTextColor="#9A8D95"
            style={styles.input}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>How heavy is it?</Text>
          <Text style={styles.help}>This sets what each rep is worth.</Text>

          {TIER_ORDER.map((tierId) => {
            const def = HABIT_TIERS[tierId];
            const selected = tierId === tier;

            return (
              <Pressable
                key={tierId}
                onPress={() => handleTierChange(tierId)}
                style={({ pressed }) => [
                  styles.tierRow,
                  { backgroundColor: selected ? def.tint : '#FFFFFF' },
                  selected && { borderColor: def.ink },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.tierTextWrap}>
                  <Text style={[styles.tierLabel, selected && { color: def.ink }]}>
                    {def.label}
                  </Text>
                  <Text style={styles.tierBlurb}>{def.blurb}</Text>
                </View>

                <View style={[styles.pearlChip, selected && { backgroundColor: '#FFFFFF' }]}>
                  <Text style={[styles.pearlChipText, selected && { color: def.ink }]}>
                    {def.pearls}
                    {def.rewardModel === 'budget' ? '/day' : ' ea'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>How many times a day?</Text>
          <Text style={styles.help}>
            {maxTimes === 1
              ? 'Keystone habits are once a day by design.'
              : `Caps the pearls this can pay out in one day. Up to ${maxTimes}.`}
          </Text>

          <View style={styles.stepperRow}>
            <Pressable
              onPress={() => setTimesPerDay((prev) => Math.max(1, prev - 1))}
              disabled={timesPerDay <= 1}
              style={({ pressed }) => [
                styles.stepperButton,
                timesPerDay <= 1 && styles.stepperDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.stepperText}>−</Text>
            </Pressable>

            <View style={styles.stepperValueWrap}>
              <Text style={styles.stepperValue}>{timesPerDay}</Text>
              <Text style={styles.stepperUnit}>
                {timesPerDay === 1 ? 'time a day' : 'times a day'}
              </Text>
            </View>

            <Pressable
              onPress={() => setTimesPerDay((prev) => Math.min(maxTimes, prev + 1))}
              disabled={timesPerDay >= maxTimes}
              style={({ pressed }) => [
                styles.stepperButton,
                timesPerDay >= maxTimes && styles.stepperDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
          </View>

          <View style={styles.mathBox}>
            <Text style={styles.mathText}>
              {tierDef.rewardModel === 'budget' ? (
                <>
                  {timesPerDay} × {pearlsForRep(tier, timesPerDay, 1)} ={' '}
                  <Text style={styles.mathStrong}>
                    {dailyPearlTotal(tier, timesPerDay)} pearls
                  </Text>{' '}
                  a day, plus your streak bonus. Splitting it into more reps divides
                  the same total — it never pays more.
                </>
              ) : (
                <>
                  {timesPerDay} × {tierDef.pearls} = up to{' '}
                  <Text style={styles.mathStrong}>
                    {dailyPearlTotal(tier, timesPerDay)} pearls
                  </Text>{' '}
                  a day, plus your streak bonus.
                </>
              )}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Reminder note</Text>
          <TextInput
            value={reminderText}
            onChangeText={setReminderText}
            placeholder="Optional nudge to yourself"
            placeholderTextColor="#9A8D95"
            style={styles.input}
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={({ pressed }) => [
            styles.saveButton,
            !canSave && styles.saveDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.saveButtonText}>
            {isEditing ? 'Save changes' : 'Create habit'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>

        {isEditing && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
          >
            <Text style={styles.deleteButtonText}>Delete habit</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF6FB' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E6D8F3',
    minWidth: 78,
    alignItems: 'center',
  },
  backPillText: { color: '#6D5A7B', fontSize: 13, fontWeight: '700' },
  topTitle: { fontSize: 16, fontWeight: '800', color: '#5B4A63' },
  topSpacer: { width: 78 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1D6E6',
    padding: 16,
    marginBottom: 12,
  },
  label: { fontSize: 15, fontWeight: '800', color: '#5A4C60', marginBottom: 6 },
  help: { fontSize: 12, color: '#8B7682', marginBottom: 12, lineHeight: 17 },
  input: {
    backgroundColor: '#FFFDFE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECD8E6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#5D4E5D',
    marginBottom: 10,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ECD8E6',
    padding: 12,
    marginBottom: 8,
  },
  tierTextWrap: { flex: 1 },
  tierLabel: { fontSize: 14, fontWeight: '800', color: '#5D4E5D', marginBottom: 2 },
  tierBlurb: { fontSize: 12, color: '#8B7682', lineHeight: 16 },
  pearlChip: {
    backgroundColor: '#F3ECF7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 10,
  },
  pearlChipText: { fontSize: 13, fontWeight: '900', color: '#6C5A92' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepperButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F4F0FF',
    borderWidth: 1,
    borderColor: '#D8CBF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: { opacity: 0.4 },
  stepperText: { fontSize: 24, fontWeight: '900', color: '#6C5A92', lineHeight: 28 },
  stepperValueWrap: { flex: 1, alignItems: 'center' },
  stepperValue: { fontSize: 30, fontWeight: '900', color: '#5A4C60' },
  stepperUnit: { fontSize: 12, color: '#8B7682' },
  mathBox: {
    backgroundColor: '#FFF8FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3D9E8',
    padding: 12,
    marginTop: 14,
  },
  mathText: { fontSize: 12, color: '#8B7682', lineHeight: 17 },
  mathStrong: { fontWeight: '900', color: '#B0608B' },
  saveButton: {
    backgroundColor: '#F0B9D7',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DB8FB9',
    marginBottom: 10,
  },
  saveDisabled: { opacity: 0.45 },
  saveButtonText: { color: '#5F3F56', fontSize: 14, fontWeight: '800' },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6DAE2',
    marginBottom: 10,
  },
  cancelButtonText: { color: '#8B7682', fontSize: 13, fontWeight: '800' },
  deleteButton: {
    backgroundColor: '#FFE5EA',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0B7C8',
  },
  deleteButtonText: { color: '#B25570', fontSize: 13, fontWeight: '800' },
  pressed: { transform: [{ translateY: 2 }], opacity: 0.9 },
});
