import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useCafeState } from '../hooks/useCafeState';
import { buildGuideContext, resolveGuideMessage } from '../hooks/guideEngine';
import {
  GUIDE_CAT_ID,
  GUIDE_SCRIPT,
  GuideAction,
  GuideBeat,
  GuideKind,
} from '../constants/guideScript';
import { CatSprite } from './CatSprite';

// Minimum time between two different beats appearing, so quickly tapping
// through tabs doesn't spam several different popups back to back.
const MIN_GAP_MS = 4000;
const SNOOZE_MINUTES = 25;

/**
 * One palette per kind of beat, so a celebration doesn't arrive wearing the
 * same face as a chore. Only the trim is tinted — the bubble stays near-white
 * because the message is the point.
 */
const TONES: Record<GuideKind, {
  ring: string;
  deep: string;
  soft: string;
  ink: string;
}> = {
  moment: { ring: '#F3CE7A', deep: '#C58F2D', soft: '#FFF3D6', ink: '#7A5A1E' },
  orientation: { ring: '#F2B6D0', deep: '#C77BA0', soft: '#FDE9F1', ink: '#8A4A67' },
  nudge: { ring: '#A6D0E9', deep: '#5F97BB', soft: '#E4F1FA', ink: '#38617D' },
};

const BUBBLE_FACE = '#FFFDFB';

/**
 * Who's talking. Every line in `guideScript.ts` is written as Sage speaking,
 * so the bubble names her — a tip from a cat you can go and adopt reads
 * differently from the same sentence delivered by the game.
 */
const SPEAKER = 'sage';

interface GuideContent {
  icon: string;
  title: string;
  tone: GuideKind;
  /** Null for the name prompt, which draws an input instead of a message. */
  beat: GuideBeat | null;
  body: string;
}

export default function GuideOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    state,
    isLoading,
    daysSinceLastOpen,
    setUserName,
    setGuideContext,
    recordGuideShown,
    snoozeGuideMessages,
    muteGuideMessage,
  } = useCafeState();

  const [nameDraft, setNameDraft] = useState(state.userName || '');
  const [activeBeatId, setActiveBeatId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const pop = useRef(new Animated.Value(0)).current;
  const avatarPop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  const needsName = !state.userName;

  // Several beats are gated purely by time (min-gap, cooldowns, snoozes),
  // so re-evaluation can't rely on state changes alone — a mission that's
  // already saved or an hour that hasn't arrived yet wouldn't otherwise
  // trigger a re-check once the clock catches up.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // A beat belongs to the screen it was resolved for. This overlay is a
  // sibling of the navigator, so without this it simply rides along: you get
  // told what the Growth Hub is while standing in the café, and the "got it"
  // you press is answering a question about a room you already left.
  //
  // Declared *above* the resolver on purpose. Effects run in order, so
  // clearing first means the resolver's early return on `activeBeatId` still
  // sees the stale beat this render and defers to the next one, instead of
  // resolving a fresh beat that this effect would immediately throw away.
  const screenKeyRef = useRef(`${pathname}|${state.guideContext}`);
  useEffect(() => {
    const key = `${pathname}|${state.guideContext}`;
    if (screenKeyRef.current === key) return;
    screenKeyRef.current = key;
    setActiveBeatId(null);
  }, [pathname, state.guideContext]);

  // Whenever nothing is currently on screen, ask the engine if there's
  // something worth showing given the latest state/route. Since `state` is
  // a dependency, this re-checks on every meaningful change (new streak,
  // mission claimed, plants gone dry) as well as every tick.
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

  const content: GuideContent | null = useMemo(() => {
    if (!visible) return null;
    if (needsName) {
      return {
        icon: '🐾',
        title: 'what should I call you?',
        tone: 'orientation',
        beat: null,
        body: '',
      };
    }
    if (!activeBeat) return null;
    return {
      icon: activeBeat.icon,
      title: activeBeat.title,
      tone: activeBeat.kind,
      beat: activeBeat,
      body: activeBeat.message(buildGuideContext(state, pathname, daysSinceLastOpen)),
    };
  }, [visible, needsName, activeBeat, state, pathname, daysSinceLastOpen]);

  // The bubble has to stay mounted through its exit or the animation never
  // plays — the old version returned null the same render the flag flipped,
  // which made every dismissal a hard cut. `shown` keeps the last content on
  // screen so it has something to shrink.
  const [mounted, setMounted] = useState(false);
  const lastContent = useRef<GuideContent | null>(null);
  useEffect(() => {
    if (content) lastContent.current = content;
  }, [content]);
  const shown = content ?? lastContent.current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(pop, {
          toValue: 1,
          useNativeDriver: true,
          friction: 6,
          tension: 120,
        }),
        // Sage lands a beat after the bubble and overshoots harder, so they
        // read as two objects arriving rather than one card fading up.
        Animated.sequence([
          Animated.delay(80),
          Animated.spring(avatarPop, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
            tension: 160,
          }),
        ]),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(pop, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(avatarPop, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, pop, avatarPop]);

  // A slow idle bob, so Sage standing there waiting for a tap still reads as
  // breathing rather than pasted on.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, bob]);

  const handleSaveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setUserName(trimmed);
  };

  const handleAction = (beat: GuideBeat, action: GuideAction) => {
    if (action.kind === 'navigate' && action.path) {
      router.push(action.path as never);
    }
    // Beats summoned by a button match on a one-shot context. Leaving it set
    // would re-fire them the moment the anti-flicker gap lapses, on a loop the
    // user can't escape.
    if (beat.consumesContext) setGuideContext('');
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

  if (!mounted || !shown) return null;

  const tone = TONES[shown.tone];
  const beat = shown.beat;

  const bubbleStyle: Animated.WithAnimatedObject<ViewStyle> = {
    opacity: pop,
    transform: [
      { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
      { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
    ],
  };

  const avatarStyle: Animated.WithAnimatedObject<ViewStyle> = {
    opacity: avatarPop,
    transform: [
      { scale: avatarPop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
      { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
    ],
  };

  return (
    <View pointerEvents="box-none" style={styles.row}>
      {/* Sage drawn from the roster, not a mascot asset — she stays adoptable
          in the shelter, so the guide's face is a cat you can go and take home.
          No frame around her: a ringed circle turned her into an app icon, and
          the whole point is that she's standing beside the bubble, not printed
          on it. She's drawn larger than anything else in the overlay because
          she's the one talking — the bubble is the smaller half of this. The
          negative margin is the overlap, and it's kept under the bubble's own
          left padding so she leans on the edge without ever sitting on a word.
          (Web-only, per convention 12 — CatSprite goes through
          `utils/pixelSvg.ts` like the currency pills in the top bar.) */}
      <Animated.View pointerEvents="none" style={[styles.catCol, avatarStyle]}>
        <CatSprite catId={GUIDE_CAT_ID} size={108} />
      </Animated.View>

      <Animated.View style={[styles.bubbleCol, bubbleStyle]} pointerEvents="box-none">
        <View style={[styles.bubbleShadow, { backgroundColor: tone.deep }]}>
          <View style={[styles.bubbleFace, { borderColor: tone.ring }]} pointerEvents="auto">
            <View style={styles.speakerRow}>
              {/* The beat's own emoji, kept small. It used to be the avatar;
                  with Sage in the frame it just marks what kind of beat this
                  is, which is all it was ever really doing. */}
              <Text style={styles.speakerIcon}>{shown.icon}</Text>
              <Text style={[styles.speaker, { color: tone.deep }]}>{SPEAKER}</Text>
            </View>

            <Text style={[styles.title, { color: tone.ink }]}>{shown.title}</Text>

            {beat ? (
              <>
                <Text style={styles.body}>{shown.body}</Text>

                <View style={styles.actionsRow}>
                  {beat.actions.map((action, index) => (
                    <BubbleButton
                      key={action.label}
                      label={action.label}
                      tone={tone}
                      primary={index === 0}
                      onPress={() => handleAction(beat, action)}
                    />
                  ))}
                </View>

                <View style={styles.footerRow}>
                  <FooterChip label={`later — ${SNOOZE_MINUTES}m`} onPress={handleSnooze} />
                  {beat.repeatable && (
                    <FooterChip label="don't show again" onPress={() => handleMute(beat)} />
                  )}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  I&apos;m sage — I look after the shelter down the road, and I&apos;ll be the
                  one showing you around. the café needs a name on the door first, though,
                  and yours will do.
                </Text>

                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  placeholder="your name"
                  placeholderTextColor="#B7A6AF"
                  style={[styles.input, { borderColor: tone.ring }]}
                  onSubmitEditing={handleSaveName}
                  returnKeyType="done"
                />

                <View style={styles.actionsRow}>
                  <BubbleButton
                    label="that's me"
                    tone={tone}
                    primary
                    onPress={handleSaveName}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * A fat pill that physically presses down. The hard offset shadow is the same
 * trick the hub tiles use — no blur, just a solid slab underneath that the
 * face slides onto when you push it.
 */
function BubbleButton({
  label,
  tone,
  primary,
  onPress,
}: {
  label: string;
  tone: { ring: string; deep: string; soft: string; ink: string };
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: tone.ring, borderColor: tone.deep }
          : { backgroundColor: '#F6F1F4', borderColor: '#E2D6DE' },
        {
          transform: [{ translateY: pressed ? 4 : 0 }],
          shadowOffset: { width: 0, height: pressed ? 0 : 4 },
          shadowColor: primary ? tone.deep : '#D9CBD4',
          elevation: pressed ? 0 : 4,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? tone.ink : '#8B7682' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FooterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 92,
    zIndex: 200,
    flexDirection: 'row',
    // Her feet and the bubble's floor share a line, so she stands next to it
    // rather than floating beside it — and on a short beat she tops out well
    // above the bubble, which is the point.
    alignItems: 'flex-end',
  },
  // The overlap is smaller than the bubble's own left padding, so she leans on
  // the border and the shadow slab without ever covering a letter.
  catCol: {
    marginRight: -10,
    marginBottom: -2,
    zIndex: 2,
  },
  bubbleCol: {
    flex: 1,
  },
  bubbleShadow: {
    borderRadius: 26,
    paddingBottom: 6,
  },
  bubbleFace: {
    backgroundColor: BUBBLE_FACE,
    borderRadius: 26,
    borderWidth: 3,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
  },
  speaker: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  speakerIcon: {
    fontSize: 11,
    lineHeight: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    color: '#6F5D67',
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '700',
    color: '#5A4B55',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    flexGrow: 1,
    borderRadius: 999,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  buttonText: {
    fontWeight: '900',
    fontSize: 13,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    backgroundColor: '#F6F1F4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 10,
    color: '#A08D99',
    fontWeight: '800',
  },
});
