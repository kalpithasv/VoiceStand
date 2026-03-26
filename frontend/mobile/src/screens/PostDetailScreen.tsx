import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
} from "react-native";
import Constants from "expo-constants";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../lib/api";
import type { CommentOut, PostOut } from "../lib/types";
import { RootStackParamList } from "../types";

export type Props = NativeStackScreenProps<RootStackParamList, "PostDetail">;

function resolveImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const base = Constants.expoConfig?.extra?.apiUrl ?? "http://127.0.0.1:8000";
  if (imagePath.startsWith("/")) return `${base}${imagePath}`;
  return imagePath;
}

export default function PostDetailScreen({ route, navigation }: Props) {
  const { postId } = route.params;

  const [post, setPost] = useState<PostOut | null>(null);
  const [comments, setComments] = useState<CommentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [negative, setNegative] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
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

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setError(null);
    if (!opts?.silent) setLoading(true);
    try {
      const detail = await apiFetch<{ post: PostOut; comments: CommentOut[] }>(`/posts/${postId}`, { method: "GET" });
      setPost(detail.post);
      setComments(detail.comments);
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!alive) return;
      await load();
    })();

    const timer = setInterval(() => {
      if (!alive) return;
      void load({ silent: true });
    }, 7000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function vote(v: "up" | "down") {
    if (!post) return;
    try {
      const updated = await apiFetch<PostOut>(`/posts/${post.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote: v }),
      });
      setPost(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function submitComment() {
    if (!post) return;
    if (!commentText.trim()) {
      setError("Write a comment first");
      return;
    }
    setPostingComment(true);
    setError(null);
    try {
      await apiFetch<PostOut>(`/posts/${post.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: commentText, is_negative: negative }),
      });
      setCommentText("");
      setNegative(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPostingComment(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{post?.locality_code ?? "Post"}</Text>
        <View style={{ width: 70 }} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : !post ? (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={{ color: "#6b7280" }}>Post not available</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          <View style={styles.card}>
            <Text style={styles.reporter}>{post.reporter_email}</Text>
            <Text style={styles.badge}>
              {post.moderation_status === "pending"
                ? `Live • ${getTimeRemaining(post.expires_at).hours}h ${getTimeRemaining(post.expires_at).minutes}m left`
                : post.moderation_status === "legit"
                  ? "Verified"
                  : "Wrong"}
            </Text>
            <Text style={styles.explanation}>{moderationExplanation(post)}</Text>
            <Text style={styles.text}>{post.text}</Text>
            {post.image_path ? (
              <Image source={{ uri: resolveImageUrl(post.image_path) ?? undefined }} style={styles.image} />
            ) : null}

            <View style={styles.voteRow}>
              <Pressable style={styles.voteBtn} onPress={() => vote("up")}>
                <Text style={styles.voteText}>Upvote ({post.upvotes_count})</Text>
              </Pressable>
              <Pressable style={styles.voteBtn} onPress={() => vote("down")}>
                <Text style={styles.voteText}>Downvote ({post.downvotes_count})</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Comments</Text>

            <TextInput
              style={styles.commentInput}
              placeholder="Add context (optionally mark as false news)"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />

            <View style={styles.negativeRow}>
              <Switch value={negative} onValueChange={setNegative} />
              <Text style={styles.negativeLabel}>Mark as negative / false news</Text>
            </View>

            <Pressable style={styles.sendBtn} onPress={submitComment} disabled={postingComment}>
              <Text style={styles.sendBtnText}>{postingComment ? "Sending..." : "Send comment"}</Text>
            </Pressable>

            <View style={{ height: 12 }} />

            {comments.length === 0 ? (
              <Text style={{ color: "#6b7280" }}>No comments yet.</Text>
            ) : null}

            {comments.map((c) => (
              <View key={c.id} style={[styles.commentCard, c.is_negative ? styles.commentCardNegative : null]}>
                <Text style={styles.commentMeta}>
                  User {c.user_id} • {new Date(c.created_at).toLocaleString()}
                </Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  topBar: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backText: { color: "#2563eb", fontWeight: "700" },
  title: { fontSize: 14, color: "#6b7280" },
  error: { color: "#b91c1c", paddingHorizontal: 14, paddingTop: 10, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#eee", padding: 14, marginBottom: 12 },
  reporter: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  badge: { fontSize: 12, color: "#6b7280", marginBottom: 10 },
  explanation: { fontSize: 12, color: "#6b7280", marginBottom: 10, lineHeight: 16 },
  text: { fontSize: 13, lineHeight: 18, color: "#111827" },
  image: { width: "100%", height: 240, borderRadius: 16, marginTop: 12 },
  voteRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  voteBtn: { flex: 1, backgroundColor: "#f4f4f5", paddingVertical: 10, borderRadius: 999, alignItems: "center", marginRight: 8 },
  voteText: { fontSize: 12, fontWeight: "700" },
  sendBtn: { backgroundColor: "#111827", paddingVertical: 12, borderRadius: 999, alignItems: "center", marginTop: 10 },
  sendBtnText: { color: "#fff", fontWeight: "800" },
  sectionTitle: { fontWeight: "800", marginBottom: 10 },
  commentInput: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 14, padding: 12, minHeight: 90, textAlignVertical: "top" },
  negativeRow: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  negativeLabel: { color: "#374151" },
  commentCard: { marginTop: 12, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#f9fafb", borderRadius: 14, padding: 12 },
  commentCardNegative: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  commentMeta: { color: "#6b7280", fontSize: 12, marginBottom: 6 },
  commentText: { color: "#111827", fontSize: 13, lineHeight: 18 },
});

