import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { useCafeState } from '../hooks/useCafeState';
import { buildGuideContext, resolveGuideMessage } from '../hooks/guideEngine';
import { GUIDE_SCRIPT, GuideAction, GuideBeat } from '../constants/guideScript';

// Minimum time between two different beats appearing, so quickly tapping
// through tabs doesn't spam several different popups back to back.
const MIN_GAP_MS = 4000;
const SNOOZE_MINUTES = 25;

export default function GuideOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    state,
    isLoading,
    daysSinceLastOpen,
    setUserName,
    recordGuideShown,
    snoozeGuideMessages,
    muteGuideMessage,
  } = useCafeState();

  const insets = useSafeAreaInsets();
  const [nameDraft, setNameDraft] = useState(state.userName || '');
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useRef(new Animated.Value(140)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const needsName = !state.userName;

  // The card is absolutely positioned, so a KeyboardAvoidingView can't lift it
  // the way it would a normal layout child — it has to follow the keyboard
  // itself, or the name prompt ends up underneath the thing typing into it.
  useEffect(() => {
    // `will` events fire before the keyboard animates in, so the card travels
    // with it rather than after it. Android only emits the `did` pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) =>
      setKeyboardHeight(event.endCoordinates.height)
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Several beats are gated purely by time (min-gap, cooldowns, snoozes),
  // so re-evaluation can't rely on state changes alone — a queue that never
  // moves or a mission that's already saved wouldn't otherwise trigger a
  // re-check once the clock catches up.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Whenever nothing is currently on screen, ask the engine if there's
  // something worth showing given the latest state/route. Since `state` is
  // a dependency, this re-checks on every meaningful change (new streak,
  // queue backing up, mission claimed, etc.) as well as every tick.
  useEffect(() => {
    if (isLoading || needsName || activeBeatId) return;
    if (state.focusSessionActive) return;
    // An adoption reveal owns the screen while it's up.
    if (state.revealActive) return;
    if (state.guide.snoozedUntil && Date.now() < state.guide.snoozedUntil) return;
    if (Date.now() - state.guide.lastShownAt < MIN_GAP_MS) return;

    const ctx = buildGuideContext(state, pathname, daysSinceLastOpen);
    const next = resolveGuideMessage(ctx);
    if (next) setActiveBeatId(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pathname, isLoading, needsName, activeBeatId, daysSinceLastOpen, tick]);

  const activeBeat: GuideBeat | undefined = useMemo(
    () => GUIDE_SCRIPT.find((beat) => beat.id === activeBeatId),
    [activeBeatId]
  );

  // An adoption reveal takes the whole screen. Refusing new beats isn't enough
  // — a beat already on screen would otherwise sit on top of it, since this
  // overlay is a sibling of the navigator and outranks anything inside it.
  const visible = (needsName || !!activeBeat) && !state.revealActive;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: visible ? 0 : 140,
        useNativeDriver: true,
        speed: 14,
        bounciness: 7,
      }),
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  const handleSaveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setUserName(trimmed);
  };

  const handleAction = (beat: GuideBeat, action: GuideAction) => {
    if (action.kind === 'navigate' && action.path) {
      router.push(action.path as never);
    }
    recordGuideShown(beat.id);
    setActiveBeatId(null);
  };

  const handleSnooze = () => {
    // Not marked "seen" — a snooze is "not now", not "never show again", so
    // the beat can still legitimately resurface once the window passes.
    snoozeGuideMessages(SNOOZE_MINUTES);
    setActiveBeatId(null);
  };

  const handleMute = (beat: GuideBeat) => {
    muteGuideMessage(beat.id);
    setActiveBeatId(null);
  };

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY }],
          // Sits just above the keyboard while typing, and just above the
          // home indicator otherwise.
          bottom: keyboardHeight > 0 ? keyboardHeight + 12 : insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.card} pointerEvents="auto">
        {needsName ? (
          <>
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>🐾</Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.eyebrow}>before we start</Text>
                <Text style={styles.title}>what should I call you?</Text>
              </View>
            </View>

            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Enter your name"
              placeholderTextColor="#9A8D95"
              style={styles.input}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />

            <Pressable onPress={handleSaveName} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Save Name</Text>
            </Pressable>
          </>
        ) : activeBeat ? (
          <>
            <View style={styles.headerRow}>
              <View style={styles.iconBadge}>
                <Text style={styles.iconBadgeText}>{activeBeat.icon}</Text>
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={styles.eyebrow}>guide</Text>
                <Text style={styles.title}>{activeBeat.title}</Text>
              </View>
            </View>

            <Text style={styles.body}>
              {activeBeat.message(buildGuideContext(state, pathname, daysSinceLastOpen))}
            </Text>

            <View style={styles.actionsRow}>
              {activeBeat.actions.map((action, index) => (
                <Pressable
                  key={action.label}
                  onPress={() => handleAction(activeBeat, action)}
                  style={[
                    styles.actionButton,
                    index === 0 ? styles.primaryButton : styles.secondaryButton,
                  ]}
                >
                  <Text
                    style={
                      index === 0 ? styles.primaryButtonText : styles.secondaryButtonText
                    }
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.footerRow}>
              <Pressable onPress={handleSnooze} hitSlop={6}>
                <Text style={styles.footerLink}>remind me in {SNOOZE_MINUTES}m</Text>
              </Pressable>

              {activeBeat.repeatable && (
                <Pressable onPress={() => handleMute(activeBeat)} hitSlop={6}>
                  <Text style={styles.footerLink}>don't show this again</Text>
                </Pressable>
              )}
            </View>
          </>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    // `bottom` is applied inline — it tracks the keyboard and the safe area.
    zIndex: 200,
  },
  card: {
    backgroundColor: '#FFFDFE',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EFD6E3',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#D88CB7',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBE6ED',
    borderWidth: 1,
    borderColor: '#F0C3D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeText: {
    fontSize: 17,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C06C98',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4E3226',
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6F5D67',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ECD6E2',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
    color: '#5A4B55',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: '#F6C8DD',
    borderColor: '#DEA5C3',
    shadowColor: '#D98FB4',
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  primaryButtonText: {
    color: '#5A4250',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: '#F5F0F3',
    borderColor: '#E6DAE2',
  },
  secondaryButtonText: {
    color: '#8B7682',
    fontWeight: '800',
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  footerLink: {
    fontSize: 11,
    color: '#B08CA5',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
