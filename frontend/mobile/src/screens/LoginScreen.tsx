import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiFetch } from "../lib/api";
import type { TokenResponse } from "../lib/types";
import { useAuth } from "../lib/auth";
import { RootStackParamList } from "../types";

export type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<TokenResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await login(res.access_token);
      navigation.replace("Feed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      <Text style={styles.subtitle}>Vote locally. Report responsibly.</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Signup")} style={styles.linkRow}>
        <Text style={styles.linkText}>New here? Create an account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", backgroundColor: "#f5f5f5" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 6 },
  subtitle: { color: "#6b7280", marginBottom: 18 },
  error: { color: "#b91c1c", marginBottom: 12, fontWeight: "600" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12 },
  button: { backgroundColor: "#111827", padding: 14, borderRadius: 999, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  linkRow: { marginTop: 14 },
  linkText: { color: "#374151", textDecorationLine: "underline" },
});

