import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "./src/lib/auth";

import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import FeedScreen from "./src/screens/FeedScreen";
import ComposeScreen from "./src/screens/ComposeScreen";
import PostDetailScreen from "./src/screens/PostDetailScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import type { RootStackParamList } from "./src/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={token ? "authed" : "anon"}
        initialRouteName={token ? "Feed" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Feed" component={FeedScreen} />
        <Stack.Screen name="Compose" component={ComposeScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f5f5" },
});
