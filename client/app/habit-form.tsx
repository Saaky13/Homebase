import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { useCafeState } from '../hooks/useCafeState';
import {
  dailyPearlTotal,
  HABIT_TIERS,
  HabitTier,
  pearlsForRep,
  TIER_ORDER,
} from '../constants/habitTiers';
import {
  PixelButton,
  PixelChip,
  PixelPanel,
  PixelText,
  usePixelMaterial,
} from '../components/pixel';
import {
  ACCENTS,
  BEVEL_THIN,
  PIXEL_FONT,
  PIXEL_FONT_FILE,
  PX,
} from '../constants/pixelTheme';

/** The danger accent — the kit has no red, and this form is where deleting lives. */
const DANGER = '#D96C6C';

/**
 * The habit form, on the hub's pixel kit.
 *
 * It ran the old soft-card styles long after the hub converted, which meant
 * long-pressing a pixel tile opened a rounded pastel modal from a different
 * app. It also carried the hub's worst functional bug: deleting a habit went
 * through `Alert.alert` with buttons, which react-native-web renders as
 * nothing — the button simply did nothing on the platform the app runs on.
 * Deletion is now a two-step press on the button itself, so the confirmation
 * is visible everywhere the form is.
 */
export default function HabitFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, addHabit, updateHabit, removeHabit } = useCafeState();

  const m = usePixelMaterial();

  // Loaded here as well as in the hub — expo-font caches by name, so this is
  // free when the hub already loaded it, and it covers the form being opened
  // fresh (a web reload lands directly on this route).
  const [fontLoaded] = useFonts({ [PIXEL_FONT]: PIXEL_FONT_FILE });

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

  // Two-step delete. First press arms; second press within the window
  // deletes. The timeout disarms it so an armed delete can't lie in wait
  // under a thumb that comes back minutes later.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    []
  );

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
    // The button is disabled without a name, so no alert branch is needed.
    if (!canSave) return;

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

    if (!confirmingDelete) {
      setConfirmingDelete(true);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setConfirmingDelete(false), 4000);
      return;
    }

    removeHabit(existing.id);
    router.back();
  };

  const maxTimes = tierDef.maxTimesPerDay;

  // Same rule as the hub: hold the first paint until the pixel face is in,
  // or every label reflows the moment it lands.
  if (!fontLoaded) {
    return <SafeAreaView style={[styles.container, { backgroundColor: m.bg }]} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: m.bg }]}>
      <View style={styles.topBar}>
        <PixelButton
          material={m}
          behind={m.bg}
          onPress={() => router.back()}
          contentStyle={styles.backFace}
        >
          <PixelText size="small" color={m.inkDim}>
            {'< Cancel'}
          </PixelText>
        </PixelButton>

        <PixelText size="title" color={m.ink}>
          {isEditing ? 'Edit habit' : 'New habit'}
        </PixelText>

        <View style={styles.topSpacer} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <PixelPanel material={m} behind={m.bg} style={styles.card}>
          <PixelText size="label" color={m.ink} style={styles.label}>
            What is it?
          </PixelText>

          <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={styles.inputWell}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Go to the gym"
              placeholderTextColor={m.inkDim}
              style={[styles.input, { color: m.ink }]}
              autoFocus={!isEditing}
            />
          </PixelPanel>

          <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={styles.inputWell}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Why it matters (optional)"
              placeholderTextColor={m.inkDim}
              style={[styles.input, { color: m.ink }]}
            />
          </PixelPanel>
        </PixelPanel>

        <PixelPanel material={m} behind={m.bg} style={styles.card}>
          <PixelText size="label" color={m.ink} style={styles.label}>
            How heavy is it?
          </PixelText>
          <PixelText size="small" color={m.inkDim} plain style={styles.help}>
            This sets what each rep is worth.
          </PixelText>

          {TIER_ORDER.map((tierId) => {
            const def = HABIT_TIERS[tierId];
            const selected = tierId === tier;

            return (
              <PixelButton
                key={tierId}
                material={m}
                behind={m.face}
                // The tier's ink at stripe width — its pale tint would sink
                // into the face, and an unselected row wears no stripe at all.
                accent={selected ? def.ink : undefined}
                dimmed={!selected}
                onPress={() => handleTierChange(tierId)}
                style={styles.tierRow}
                contentStyle={styles.tierFace}
              >
                <View style={styles.tierTextWrap}>
                  <PixelText size="label" color={m.ink}>
                    {def.label}
                  </PixelText>
                  <PixelText size="small" color={m.inkDim} plain style={styles.tierBlurb}>
                    {def.blurb}
                  </PixelText>
                </View>

                <PixelChip
                  label={`${def.pearls}${def.rewardModel === 'budget' ? '/day' : ' ea'}`}
                  material={m}
                  tint={def.tint}
                  color={def.ink}
                />
              </PixelButton>
            );
          })}
        </PixelPanel>

        <PixelPanel material={m} behind={m.bg} style={styles.card}>
          <PixelText size="label" color={m.ink} style={styles.label}>
            How many times a day?
          </PixelText>
          <PixelText size="small" color={m.inkDim} plain style={styles.help}>
            {maxTimes === 1
              ? 'Keystone habits are once a day by design.'
              : `Caps the pearls this can pay out in one day. Up to ${maxTimes}.`}
          </PixelText>

          <View style={styles.stepperRow}>
            <PixelButton
              material={m}
              behind={m.face}
              disabled={timesPerDay <= 1}
              dimmed={timesPerDay <= 1}
              onPress={() => setTimesPerDay((prev) => Math.max(1, prev - 1))}
              contentStyle={styles.stepperFace}
            >
              <PixelText size="title" color={m.ink}>
                -
              </PixelText>
            </PixelButton>

            <View style={styles.stepperValueWrap}>
              <PixelText size="hero" color={m.ink}>
                {timesPerDay}
              </PixelText>
              <PixelText size="small" color={m.inkDim}>
                {timesPerDay === 1 ? 'time a day' : 'times a day'}
              </PixelText>
            </View>

            <PixelButton
              material={m}
              behind={m.face}
              disabled={timesPerDay >= maxTimes}
              dimmed={timesPerDay >= maxTimes}
              onPress={() => setTimesPerDay((prev) => Math.min(maxTimes, prev + 1))}
              contentStyle={styles.stepperFace}
            >
              <PixelText size="title" color={m.ink}>
                +
              </PixelText>
            </PixelButton>
          </View>

          <PixelPanel material={m} inset bevel={BEVEL_THIN} style={styles.mathBox}>
            <PixelText size="small" color={m.inkDim} plain style={styles.mathText}>
              {tierDef.rewardModel === 'budget'
                ? `${timesPerDay} x ${pearlsForRep(tier, timesPerDay, 1)} = ${dailyPearlTotal(
                    tier,
                    timesPerDay
                  )} pearls a day, plus your streak bonus. Splitting it into more reps divides the same total — it never pays more.`
                : `${timesPerDay} x ${tierDef.pearls} = up to ${dailyPearlTotal(
                    tier,
                    timesPerDay
                  )} pearls a day, plus your streak bonus.`}
            </PixelText>
          </PixelPanel>
        </PixelPanel>

        <PixelPanel material={m} behind={m.bg} style={styles.card}>
          <PixelText size="label" color={m.ink} style={styles.label}>
            Reminder note
          </PixelText>
          <PixelPanel material={m} inset sunken bevel={BEVEL_THIN} style={styles.inputWell}>
            <TextInput
              value={reminderText}
              onChangeText={setReminderText}
              placeholder="Optional nudge to yourself"
              placeholderTextColor={m.inkDim}
              style={[styles.input, { color: m.ink }]}
            />
          </PixelPanel>
        </PixelPanel>

        <PixelButton
          material={m}
          behind={m.bg}
          accent={ACCENTS.habits}
          onPress={handleSave}
          disabled={!canSave}
          dimmed={!canSave}
          style={styles.action}
          contentStyle={styles.actionFace}
        >
          <PixelText size="label" color={m.ink}>
            {isEditing ? 'Save changes' : 'Create habit'}
          </PixelText>
        </PixelButton>

        {isEditing && (
          <PixelButton
            material={m}
            behind={m.bg}
            accent={confirmingDelete ? DANGER : undefined}
            onPress={handleDelete}
            style={styles.action}
            contentStyle={styles.actionFace}
          >
            <PixelText size="small" color={confirmingDelete ? DANGER : m.inkDim}>
              {confirmingDelete
                ? 'Tap again to delete — this erases its history'
                : 'Delete habit'}
            </PixelText>
          </PixelButton>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Layout only — every colour is passed at render time, because it changes at dusk. */
const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PX * 8,
    paddingVertical: PX * 6,
  },
  backFace: {
    paddingHorizontal: PX * 4,
    paddingVertical: PX * 3,
  },
  topSpacer: { width: 78 },
  scroll: { flex: 1, paddingHorizontal: PX * 8 },
  card: {
    padding: PX * 5,
    marginBottom: PX * 5,
  },
  label: {
    marginBottom: PX * 2,
  },
  help: {
    marginBottom: PX * 4,
    lineHeight: 17,
  },
  inputWell: {
    marginBottom: PX * 3,
  },
  input: {
    paddingHorizontal: PX * 4,
    paddingVertical: PX * 4,
    fontSize: 14,
  },
  tierRow: {
    marginBottom: PX * 3,
  },
  tierFace: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PX * 4,
    gap: PX * 4,
  },
  tierTextWrap: { flex: 1 },
  tierBlurb: {
    marginTop: PX,
    lineHeight: 16,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PX * 6,
  },
  stepperFace: {
    width: PX * 22,
    height: PX * 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueWrap: { flex: 1, alignItems: 'center' },
  mathBox: {
    padding: PX * 4,
    marginTop: PX * 5,
  },
  mathText: {
    lineHeight: 17,
  },
  action: {
    marginBottom: PX * 4,
  },
  actionFace: {
    paddingVertical: PX * 4,
    alignItems: 'center',
  },
});
