import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PostOut, UserOut } from "../lib/types";
import { apiFetch } from "../lib/api";
import { getCurrentCoords, updateLocationOnServer } from "../lib/location";
import { RootStackParamList } from "../types";

export type Props = NativeStackScreenProps<RootStackParamList, "Feed">;

function resolveImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const base = Constants.expoConfig?.extra?.apiUrl ?? "http://127.0.0.1:8000";
  if (imagePath.startsWith("/")) return `${base}${imagePath}`;
  return imagePath;
}

export default function FeedScreen({ navigation }: Props) {
  const [me, setMe] = useState<UserOut | null>(null);
  const [feed, setFeed] = useState<PostOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  function getTimeRemaining(expiresAtIso: string) {
    const t = new Date(expiresAtIso).getTime() - now;
    const clamped = Math.max(0, t);
    const hours = Math.floor(clamped / 3_600_000);
    const minutes = Math.floor((clamped % 3_600_000) / 60_000);
    const seconds = Math.floor((clamped % 60_000) / 1000);
    return { hours, minutes, seconds, clamped };
  }

  function moderationExplanation(p: PostOut) {
    if (p.moderation_status === "pending") {
      return "Voting is open for ~5 hours. At expiry, upvotes vs downvotes decides visibility.";
    }
    if (p.moderation_status === "legit") {
      return "Verified by community: upvotes >= downvotes at expiry.";
    }
    return "Marked as false news: downvotes > upvotes at expiry. Reporter coins deducted.";
  }

  async function loadMeAndFeed() {
    const meRes = await apiFetch<UserOut>("/me", { method: "GET" });
    setMe(meRes);
    const posts = await apiFetch<PostOut[]>("/feed", { method: "GET" });
    setFeed(posts);
  }

  async function primeWithLocation() {
    const { lat, lon } = await getCurrentCoords();
    await updateLocationOnServer(lat, lon);
    await loadMeAndFeed();
  }

  async function refresh(isPullToRefresh: boolean) {
    if (isPullToRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      await primeWithLocation();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (isPullToRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    // Load once with GPS so locality filtering works.
    void (async () => {
      try {
        if (!alive) return;
        await primeWithLocation();
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    // Feed polling (real-time-ish via polling, no manual refresh required).
    const feedTimer = setInterval(() => {
      if (!alive) return;
      void loadMeAndFeed();
    }, 8000);

    // Update location periodically so locality stays correct.
    const locationTimer = setInterval(() => {
      if (!alive) return;
      void primeWithLocation();
    }, 60_000);

    // Countdown tick
    const tickTimer = setInterval(() => setNow(Date.now()), 1000);

    return () => {
      alive = false;
      clearInterval(feedTimer);
      clearInterval(locationTimer);
      clearInterval(tickTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function vote(postId: number, vote: "up" | "down") {
    try {
      const updated = await apiFetch<PostOut>(`/posts/${postId}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote }),
      });
      setFeed((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Voicestand</Text>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.meta}>{me?.locality_code ?? "Locating..."}</Text>
          <Text style={styles.meta}>Coins: {me?.coins ?? 0}</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={feed}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator />
          ) : (
            <View style={{ padding: 24 }}>
              <Text style={styles.emptyTitle}>No reports in your locality yet.</Text>
              <Pressable style={styles.postButton} onPress={() => navigation.navigate("Compose")}>
                <Text style={styles.postButtonText}>Create the first post</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.reporter_email?.[0]?.toUpperCase() ?? "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.reporter}>{item.reporter_email}</Text>
                  <Text style={styles.badge}>
                    {item.moderation_status === "pending"
                      ? `Live • ${getTimeRemaining(item.expires_at).hours}h ${getTimeRemaining(item.expires_at).minutes}m left`
                      : item.moderation_status === "legit"
                        ? "Verified"
                        : "Wrong"}
                  </Text>
                </View>
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.explanation}>{moderationExplanation(item)}</Text>
              </View>
            </View>

            {item.image_path ? (
              <Image source={{ uri: resolveImageUrl(item.image_path) ?? undefined }} style={styles.image} />
            ) : null}

            <View style={styles.actions}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={styles.actionBtn} onPress={() => vote(item.id, "up")}>
                  <Text style={styles.actionBtnText}>Upvote ({item.upvotes_count})</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => vote(item.id, "down")}>
                  <Text style={styles.actionBtnText}>Downvote ({item.downvotes_count})</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => navigation.navigate("PostDetail", { postId: item.id })}>
                <Text style={styles.discussLink}>Discuss</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate("Compose")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
      <Pressable style={styles.profileFab} onPress={() => navigation.navigate("Profile")}>
        <Text style={styles.profileFabText}>Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    paddingTop: 52,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { fontSize: 18, fontWeight: "800" },
  meta: { fontSize: 12, color: "#6b7280" },
  error: { color: "#b91c1c", paddingHorizontal: 12, paddingTop: 10, fontWeight: "600" },
  emptyTitle: { fontSize: 15, marginBottom: 16, color: "#6b7280", textAlign: "center" },
  postButton: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignSelf: "center",
    width: "100%",
  },
  postButtonText: { color: "#fff", textAlign: "center", fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
  },
  cardTop: { flexDirection: "row", gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 999, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "800", color: "#111827" },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  reporter: { fontWeight: "800", flex: 1, marginRight: 8 },
  badge: { fontSize: 12, color: "#6b7280" },
  text: { color: "#111827", fontSize: 13, lineHeight: 18 },
  explanation: { fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 16 },
  image: { width: "100%", height: 220, borderRadius: 16, marginTop: 12 },
  actions: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  actionBtn: { backgroundColor: "#f4f4f5", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999 },
  actionBtnText: { fontSize: 12, fontWeight: "700" },
  discussLink: { color: "#2563eb", textDecorationLine: "underline", fontSize: 13 },
  fab: { position: "absolute", right: 18, bottom: 82, width: 52, height: 52, backgroundColor: "#111827", borderRadius: 999, alignItems: "center", justifyContent: "center" },
  fabText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  profileFab: { position: "absolute", right: 18, bottom: 22, backgroundColor: "#e5e7eb", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  profileFabText: { fontWeight: "700", color: "#111827" },
});

