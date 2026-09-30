import { useCallback, useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { SFIcon } from "../../../../ui/SFIcon";

export type RowSwipeAction = {
  id: string;
  title: string;
  icon: string;
  /** Degrees to rotate the SF icon (the pin rides at 45). */
  iconRotation?: number;
  backgroundColor: string;
  onPress: () => void;
};

const ACTION_WIDTH = 78;

/** The solid action buttons revealed under a swiped row. */
function SwipeActions({
  actions,
  onPress,
}: {
  actions: RowSwipeAction[];
  onPress: (action: RowSwipeAction) => void;
}) {
  return (
    <View style={styles.actions}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          accessibilityRole="button"
          accessibilityLabel={action.title}
          onPress={() => onPress(action)}
          style={[styles.action, { backgroundColor: action.backgroundColor }]}
        >
          <SFIcon
            name={action.icon}
            size={21}
            color="#FFFFFF"
            rotation={action.iconRotation ?? 0}
          />
          <Text style={styles.actionTitle}>{action.title}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * iOS-style swipe actions for inbox rows: full-height solid buttons revealed
 * under the row. Swipe left for the trailing actions, swipe right for the
 * leading action. Tapping an action runs it and closes the row. The parent
 * keeps every row's ref so opening one row closes the rest.
 */
export function SwipeableRow({
  id,
  leftActions,
  rightActions,
  registerRef,
  onOpen,
  children,
}: {
  id: string;
  leftActions: RowSwipeAction[];
  rightActions: RowSwipeAction[];
  registerRef: (id: string, ref: Swipeable | null) => void;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  const ref = useRef<Swipeable>(null);

  const handleActionPress = useCallback((action: RowSwipeAction) => {
    action.onPress();
    ref.current?.close();
  }, []);
  const renderLeftActions = useCallback(
    () => <SwipeActions actions={leftActions} onPress={handleActionPress} />,
    [leftActions, handleActionPress],
  );
  const renderRightActions = useCallback(
    () => <SwipeActions actions={rightActions} onPress={handleActionPress} />,
    [rightActions, handleActionPress],
  );

  return (
    <Swipeable
      ref={(r) => {
        ref.current = r;
        registerRef(id, r);
      }}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableOpen={() => onOpen(id)}
      overshootLeft={false}
      overshootRight={false}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
  },
  action: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "SFProText-Semibold",
  },
});
