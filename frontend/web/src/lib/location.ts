import { apiFetch } from "./api";

function mapGeolocationError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location access is blocked. Enable location permission in your browser and refresh.";
    case err.POSITION_UNAVAILABLE:
      return "Unable to determine current location. Please try again.";
    case err.TIMEOUT:
      return "Location request timed out. Please try again.";
    default:
      return err.message || "Failed to get your location.";
  }
}

export async function getCurrentCoords(): Promise<{ lat: number; lon: number }> {
  if (!("geolocation" in navigator)) {
    throw new Error("Geolocation not available in this browser");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => reject(new Error(mapGeolocationError(err))),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10_000 },
    );
  });
}

export async function updateLocationOnServer(lat: number, lon: number) {
  await apiFetch("/me/location", {
    method: "POST",
    body: JSON.stringify({ lat, lon }),
  });
}

