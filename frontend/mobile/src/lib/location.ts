import * as Location from "expo-location";
import { apiFetch } from "./api";

export async function getCurrentCoords(): Promise<{ lat: number; lon: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Location permission not granted");
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export async function updateLocationOnServer(lat: number, lon: number) {
  await apiFetch("/me/location", {
    method: "POST",
    body: JSON.stringify({ lat, lon }),
  });
}

