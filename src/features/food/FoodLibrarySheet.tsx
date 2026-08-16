import { Search, Star, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { searchFoodHistory, toggleFoodFavorite } from "../../db/queries";
import {
  searchFoodDatabase,
  type FoodSearchItem,
} from "../../utils/openFoodFacts";
import { colors } from "../../theme/colors";
import { radius, typography } from "../../theme/spacing";
import { useStyles } from "../../theme/useStyles";
import { type FoodLibraryItem } from "../../types";

// ─── Food library ──────────────────────────────────────────────────────
//
// The recents strip only fits a few chips before the rest scrolls out of
// reach, which makes every older food unreachable. This is the full history,
// searchable, with favourites pinned to the top.

export function FoodLibrarySheet({
  visible,
  onClose,
  onPick,
  onLongPick,
  onPickRemote,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (item: FoodLibraryItem) => void;
  onLongPick: (item: FoodLibraryItem) => void;
  onPickRemote: (item: FoodSearchItem) => void;
}) {
  const styles = useStyles(makeStyles);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FoodLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  // Local history and the global database stay separate scopes. Blending 10k
  // branded hits into the handful of foods someone actually eats buries the
  // useful ones.
  const [scope, setScope] = useState<"mine" | "database">("mine");
  const [remote, setRemote] = useState<FoodSearchItem[]>([]);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const run = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setItems(await searchFoodHistory(q));
    } finally {
      setLoading(false);
    }
  }, []);

  const runRemote = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setRemote([]);
      setRemoteError(null);
      return;
    }
    setLoading(true);
    setRemoteError(null);
    try {
      setRemote(await searchFoodDatabase(q));
    } catch (e) {
      setRemote([]);
      setRemoteError(
        e instanceof Error ? e.message : "Could not reach the food database.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setScope("mine");
    setRemote([]);
    setRemoteError(null);
    run("");
  }, [visible, run]);

  // Debounced so typing does not fire a query per keystroke. The remote search
  // waits longer -- it is a network round trip, not a local table scan.
  useEffect(() => {
    if (!visible) return;
    if (scope === "mine") {
      const t = setTimeout(() => run(query), 180);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => runRemote(query), 400);
    return () => clearTimeout(t);
  }, [query, visible, scope, run, runRemote]);

  const onToggleFav = async (item: FoodLibraryItem) => {
    const next = await toggleFoodFavorite(item.name);
    // Patch in place rather than refetching, so the row does not jump out from
    // under the finger that just tapped it.
    setItems((prev) =>
      prev.map((i) =>
        i.name.toLowerCase() === item.name.toLowerCase()
          ? { ...i, is_favorite: next }
          : i,
      ),
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Find a food</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <X size={20} color={colors.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Search size={15} color={colors.textMuted} strokeWidth={2} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                scope === "mine"
                  ? "Search foods you've logged"
                  : "Search Open Food Facts"
              }
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
              returnKeyType="search"
            />
            {query !== "" ? (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <X size={15} color={colors.textMuted} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.scopeRow}>
            {(["mine", "database"] as const).map((sc) => (
              <Pressable
                key={sc}
                onPress={() => setScope(sc)}
                style={({ pressed }) => [
                  styles.scopeBtn,
                  scope === sc && styles.scopeBtnActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text
                  style={[
                    styles.scopeText,
                    scope === sc && styles.scopeTextActive,
                  ]}
                >
                  {sc === "mine" ? "My foods" : "Food database"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.list}
          >
            {scope === "database" ? (
              remoteError ? (
                <Text style={styles.empty}>{remoteError}</Text>
              ) : loading ? (
                <ActivityIndicator
                  color={colors.textMuted}
                  style={{ marginTop: 24 }}
                />
              ) : query.trim().length < 2 ? (
                <Text style={styles.empty}>
                  Search millions of products from Open Food Facts.
                </Text>
              ) : remote.length === 0 ? (
                <Text style={styles.empty}>
                  No products with nutrition data for &quot;{query.trim()}&quot;
                </Text>
              ) : (
                remote.map((r, i) => (
                  <Pressable
                    key={`${r.code}-${i}`}
                    onPress={() => onPickRemote(r)}
                    style={({ pressed }) => [
                      styles.row,
                      styles.rowMain,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={2}>
                        {r.brand && !r.name.toLowerCase().includes(r.brand.toLowerCase())
                          ? `${r.brand} ${r.name}`
                          : r.name}
                      </Text>
                      <Text style={styles.per100}>
                        {r.caloriesPer100g} cal · P {r.proteinPer100g}g · F{" "}
                        {r.fatPer100g}g · C {r.carbsPer100g}g{"  "}per 100 g
                      </Text>
                    </View>
                  </Pressable>
                ))
              )
            ) : loading && items.length === 0 ? (
              <ActivityIndicator
                color={colors.textMuted}
                style={{ marginTop: 24 }}
              />
            ) : items.length === 0 ? (
              <Text style={styles.empty}>
                {query.trim() === ""
                  ? "Nothing logged yet. Foods you add will show up here."
                  : `No food matching "${query.trim()}"`}
              </Text>
            ) : (
              items.map((item) => (
                <View key={item.name.toLowerCase()} style={styles.row}>
                  <Pressable
                    onPress={() => onPick(item)}
                    onLongPress={() => onLongPick(item)}
                    delayLongPress={300}
                    style={({ pressed }) => [
                      styles.rowMain,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {Math.round(item.calories)} cal · P{" "}
                      {Math.round(item.protein_g)}g · F {Math.round(item.fat_g)}g
                      · C {Math.round(item.carbs_g)}g
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onToggleFav(item)}
                    hitSlop={10}
                    accessibilityLabel={
                      item.is_favorite ? "Remove favourite" : "Add favourite"
                    }
                    style={({ pressed }) => [
                      styles.starBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Star
                      size={17}
                      color={item.is_favorite ? colors.amber : colors.textMuted}
                      fill={item.is_favorite ? colors.amber : "transparent"}
                      strokeWidth={2}
                    />
                  </Pressable>
                </View>
              ))
            )}
            <View style={{ height: 16 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (s: (n: number) => number) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 14,
      height: "78%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: { ...typography.screenTitle, fontSize: s(18), color: colors.text },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    searchInput: { flex: 1, fontSize: s(15), color: colors.text, padding: 0 },
    scopeRow: {
      flexDirection: "row",
      gap: 6,
      marginTop: 10,
    },
    scopeBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
    },
    scopeBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scopeText: { fontSize: s(12), fontWeight: "600", color: colors.textSecondary },
    scopeTextActive: { color: "#FFFFFF" },
    per100: { fontSize: s(11), color: colors.textMuted, marginTop: 2 },
    list: { marginTop: 12 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowMain: { flex: 1, paddingVertical: 12, paddingRight: 8 },
    rowName: { fontSize: s(15), fontWeight: "500", color: colors.text },
    rowMeta: { fontSize: s(12), color: colors.textSecondary, marginTop: 3 },
    starBtn: { padding: 8 },
    empty: {
      fontSize: s(13),
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 28,
      lineHeight: 19,
    },
  });
