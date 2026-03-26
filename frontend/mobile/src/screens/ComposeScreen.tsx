import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../lib/api";
import { getCurrentCoords, updateLocationOnServer } from "../lib/location";
import type { PostCreateResponse, PostOut } from "../lib/types";
import { RootStackParamList } from "../types";

export type Props = NativeStackScreenProps<RootStackParamList, "Compose">;

export default function ComposeScreen({ navigation }: Props) {
  const [text, setText] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [image, setImage] = useState<{ uri: string; type?: string; name?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await getCurrentCoords();
        setCoords(c);
        await updateLocationOnServer(c.lat, c.lon);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      setError("Media permission denied");
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!res.canceled && res.assets.length > 0) {
      const a = res.assets[0];
      setImage({
        uri: a.uri,
        type: a.mimeType ?? "image/jpeg",
        name: a.fileName ?? "upload.jpg",
      });
    }
  }

  async function submit() {
    if (!coords) {
      setError("Location required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("text", text);
      form.append("lat", String(coords.lat));
      form.append("lon", String(coords.lon));
      if (image) {
        form.append("image", {
          uri: image.uri,
          type: image.type ?? "image/jpeg",
          name: image.name ?? "upload.jpg",
        } as any);
      }

      const res = await apiFetch<PostCreateResponse>("/posts", {
        method: "POST",
        body: form,
      });

      navigation.replace("PostDetail", { postId: res.post_id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New complaint</Text>
      <Text style={styles.meta}>
        {coords ? `Lat ${coords.lat.toFixed(4)}, Lon ${coords.lon.toFixed(4)}` : "Locating..."}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Write the complaint..."
        value={text}
        onChangeText={setText}
        multiline
      />

      <View style={{ marginTop: 10 }}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.preview} />
        ) : (
          <View style={styles.pickPlaceholder}>
            <Text style={styles.pickText}>Add a picture (optional)</Text>
          </View>
        )}

        <Pressable style={styles.pickButton} onPress={pickImage}>
          <Text style={styles.pickButtonText}>Choose Image</Text>
        </Pressable>
      </View>

      <Pressable style={styles.submit} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post complaint</Text>}
      </Pressable>

      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: "#f5f5f5" },
  title: { fontSize: 26, fontWeight: "800", marginTop: 30, marginBottom: 6 },
  meta: { color: "#6b7280", marginBottom: 14 },
  error: { color: "#b91c1c", fontWeight: "700", marginBottom: 12 },
  input: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", padding: 14, minHeight: 140, textAlignVertical: "top" },
  preview: { width: "100%", height: 260, borderRadius: 16, marginTop: 12 },
  pickPlaceholder: { height: 220, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  pickText: { color: "#6b7280", fontWeight: "600" },
  pickButton: { marginTop: 10, backgroundColor: "#e5e7eb", paddingVertical: 12, borderRadius: 999, alignItems: "center" },
  pickButtonText: { fontWeight: "800" },
  submit: { marginTop: 18, backgroundColor: "#111827", paddingVertical: 14, borderRadius: 999, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800" },
  backBtn: { marginTop: 14, alignItems: "center" },
  backText: { color: "#2563eb", fontWeight: "700" },
});

