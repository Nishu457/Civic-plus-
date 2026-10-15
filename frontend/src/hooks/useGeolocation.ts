/* CivicPulse AI — Geolocation Hook */

import { useState, useCallback } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source: 'gps' | 'manual' | 'unknown';
}

interface UseGeolocationReturn {
  location: LocationData | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => void;
  setManualLocation: (lat: number, lng: number) => void;
  clearLocation: () => void;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          source: 'gps',
        });
        setLoading(false);
      },
      (err) => {
        let message = 'Location access denied.';
        if (err.code === 2) message = 'Location unavailable. Please try again.';
        if (err.code === 3) message = 'Location request timed out.';
        setError(message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  }, []);

  const setManualLocation = useCallback((lat: number, lng: number) => {
    setLocation({
      latitude: lat,
      longitude: lng,
      accuracy: 0,
      timestamp: Date.now(),
      source: 'manual',
    });
    setError(null);
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  return { location, loading, error, requestLocation, setManualLocation, clearLocation };
};
