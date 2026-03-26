import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../lib/api";
import type { PostOut, UserOut } from "../lib/types";
import { useAuth } from "../lib/auth";
import { RootStackParamList } from "../types";

export type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props) {
  const { logout } = useAuth();
  const [me, setMe] = useState<UserOut | null>(null);
  const [posts, setPosts] = useState<PostOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const meRes = await apiFetch<UserOut>("/me", { method: "GET" });
        setMe(meRes);
        const myPosts = await apiFetch<PostOut[]>("/me/posts", { method: "GET" });
        setPosts(myPosts);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onLogout() {
    await logout();
    navigation.replace("Login");
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Profile</Text>
        <Pressable onPress={onLogout}>
          <Text style={styles.logout}>Logout</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : !me ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ color: "#6b7280" }}>Could not load profile.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <View style={styles.card}>
            <Text style={styles.email}>{me.email}</Text>
            <Text style={styles.meta}>{me.locality_code ?? "No location yet"}</Text>

            <View style={styles.grid}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Coins</Text>
                <Text style={styles.statValue}>{me.coins}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Wrong streak</Text>
                <Text style={styles.statValue}>{me.wrong_streak}</Text>
              </View>
              <View style={[styles.stat, { gridColumn: "span 2" } as any]}>
                <Text style={styles.statLabel}>Total wrong posts</Text>
                <Text style={styles.statValue}>{me.wrong_total}</Text>
              </View>
            </View>

            <Text style={styles.status}>
              {me.dismissed
                ? "Account dismissed"
                : me.suspended_until
                  ? `Suspended until ${me.suspended_until}`
                  : "Active"}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Your posts</Text>

          {posts.length === 0 ? (
            <Text style={{ color: "#6b7280" }}>No posts yet.</Text>
          ) : null}

          {posts.map((p) => (
            <View key={p.id} style={styles.postCard}>
              <Text style={styles.postMeta}>{p.locality_code}</Text>
              <Text style={styles.postBadge}>
                {p.moderation_status === "pending"
                  ? "Live"
                  : p.moderation_status === "legit"
                    ? "Verified"
                    : "Wrong"}
              </Text>
              <Text style={styles.postText}>{p.text}</Text>
              <Pressable onPress={() => navigation.navigate("PostDetail", { postId: p.id })} style={{ marginTop: 8 }}>
                <Text style={styles.viewLink}>View details</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  topBar: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backText: { color: "#2563eb", fontWeight: "700" },
  title: { fontWeight: "800" },
  logout: { color: "#dc2626", fontWeight: "800" },
  error: { color: "#b91c1c", paddingHorizontal: 14, paddingTop: 10, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 18, padding: 14, marginBottom: 12 },
  email: { fontSize: 16, fontWeight: "800" },
  meta: { marginTop: 6, color: "#6b7280" },
  grid: { marginTop: 14, gap: 10 } as any,
  stat: { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 12, flex: 1 },
  statLabel: { color: "#6b7280", fontSize: 12 },
  statValue: { fontSize: 20, fontWeight: "900", marginTop: 4 },
  status: { marginTop: 14, fontWeight: "800", color: "#111827" },
  sectionTitle: { fontWeight: "900", marginBottom: 10 },
  postCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 18, padding: 14, marginBottom: 12 },
  postMeta: { color: "#6b7280", fontSize: 12, marginBottom: 6 },
  postBadge: { color: "#6b7280", fontWeight: "800", marginBottom: 6 },
  postText: { fontSize: 13, color: "#111827" },
  viewLink: { color: "#2563eb", fontWeight: "800" },
});

