import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../components/ui/avatar";
import { Glass } from "../components/ui/glass";
import { Sheet } from "../components/ui/sheet";
import { Accent, Radius, Space, Type } from "../constants/theme";
import {
  AVATAR_FACES,
  AVATAR_FACE_IDS,
  type AvatarFace,
} from "../data/people";
import { useFable } from "../data/store";
import { useTheme } from "../hooks/use-theme";

/**
 * Your profile: name, about and Memoji, all editable and persisted.
 * Same rounded-top panel language as the contact profile.
 */
export default function MyProfile() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useFable((state) => state.profile);
  const setProfile = useFable((state) => state.setProfile);

  const pickFace = (face: AvatarFace) => setProfile({ face });

  return (
    <Sheet detent={0.85}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Space[8] },
        ]}
      >
        <Avatar source={AVATAR_FACES[profile.face]} size={96} />
        <Text style={[styles.name, { color: theme.label }]}>
          {profile.name || "Your name"}
        </Text>
        <Text
          style={[
            Type.caption,
            { color: theme.secondary, marginTop: 4, textAlign: "center" },
          ]}
        >
          {profile.about || "Add a status"}
        </Text>

        <Glass style={styles.card}>
          <View style={styles.row}>
            <Text style={[Type.body, { color: theme.secondary }]}>Name</Text>
            <TextInput
              value={profile.name}
              onChangeText={(name) => setProfile({ name })}
              placeholder="Your name"
              placeholderTextColor={theme.tertiary}
              maxLength={30}
              selectionColor={Accent}
              textAlign="right"
              style={[Type.body, styles.field, { color: theme.label }]}
            />
          </View>
          <View
            style={[styles.divider, { backgroundColor: theme.hairline }]}
          />
          <View style={styles.row}>
            <Text style={[Type.body, { color: theme.secondary }]}>About</Text>
            <TextInput
              value={profile.about}
              onChangeText={(about) => setProfile({ about })}
              placeholder="Add a status"
              placeholderTextColor={theme.tertiary}
              maxLength={80}
              selectionColor={Accent}
              textAlign="right"
              style={[Type.body, styles.field, { color: theme.label }]}
            />
          </View>
        </Glass>

        <Text
          style={[Type.caption, styles.section, { color: theme.secondary }]}
        >
          Memoji
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ alignSelf: "stretch" }}
          contentContainerStyle={styles.faces}
        >
          {AVATAR_FACE_IDS.map((face) => {
            const selected = face === profile.face;
            return (
              <Pressable
                key={face}
                accessibilityRole="button"
                accessibilityLabel={`Use ${face} Memoji`}
                onPress={() => pickFace(face)}
                hitSlop={4}
                style={[
                  styles.face,
                  {
                    borderColor: selected ? Accent : "transparent",
                    backgroundColor: theme.chip,
                  },
                ]}
              >
                <Avatar source={AVATAR_FACES[face]} size={52} />
              </Pressable>
            );
          })}
        </ScrollView>
        <Text style={[Type.caption, { color: theme.tertiary, marginTop: 8 }]}>
          This is how you appear in chats.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space[4],
    paddingTop: Space[2],
    alignItems: "center",
  },
  name: {
    fontSize: 24,
    fontFamily: "SFProText-Semibold" as const,
    letterSpacing: -0.4,
    marginTop: Space[3],
  },
  card: {
    alignSelf: "stretch",
    borderRadius: Radius.card,
    borderCurve: "continuous",
    paddingHorizontal: Space[4],
    paddingVertical: Space[1],
    marginTop: Space[6],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space[3],
    paddingVertical: Space[3],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 0,
  },
  field: {
    flex: 1,
    paddingVertical: 0,
  },
  section: {
    alignSelf: "flex-start",
    marginTop: Space[6],
    marginBottom: Space[2],
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  faces: {
    gap: Space[2],
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  face: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2.5,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
});
