/**
 * hooks/useLocation.js — GPS Location & Distance Utility Hook
 *
 * Provides the user's current GPS coordinates via the browser Geolocation API,
 * with graceful fallback to a fixed reference location when GPS is unavailable.
 *
 * Also exports a standalone haversine() function used by components that need
 * to compute distances without the full hook (e.g. the live map radius circle).
 *
 * Reference location (fallback):
 *  38 Rajasinghe Road, Dehiwala, Colombo — lat: 6.868671, lng: 79.860689
 *  This is the project's fixed origin point for distance calculations.
 *  Distances shown on place cards use this as the "from" point when GPS is denied.
 *
 * Returned values:
 *  location       — { lat, lng } object; either GPS coords or REF_LOCATION
 *  locationError  — Human-readable error string, or null if GPS is available
 *  locationStatus — 'idle' | 'locating' | 'found' | 'error'
 *  getLocation()  — Imperative trigger to re-request GPS (e.g. on button click)
 *  distanceTo(lat, lng) — Returns the Haversine distance in km from current location
 *  refLocation    — The fixed reference location object (always available)
 *
 * Geolocation options:
 *  timeout: 10000          — Give up after 10 seconds and fall back to reference
 *  maximumAge: 60000       — Accept a cached position up to 60 seconds old
 *  enableHighAccuracy: true — Request high-accuracy GPS (may drain battery)
 */

import { useState, useEffect, useCallback } from 'react';

// Fixed reference: 38 Rajasinghe Road, Dehiwala, Colombo
// Used as the fallback "from" location when the user denies GPS access.
// All place distances stored in the database are calculated from this point.
// Fixed reference: 38 Rajasinghe Road, Dehiwala, Colombo
const REF_LOCATION = { lat: 6.868671, lng: 79.860689, label: '38 Rajasinghe Road, Colombo' };

// ── Haversine Distance Formula ────────────────────────────────────────────────
// Exported as a named export so other modules (LiveMapPage, PlannerPage) can
// compute distances without importing the full hook.
// Returns the great-circle distance in km between two WGS-84 coordinate pairs.
// R = 6371 km is the mean radius of the Earth.
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

// ── useLocation Hook ──────────────────────────────────────────────────────────
// Default export — call this in any component that needs the user's coordinates.
export default function useLocation() {
  const [location,       setLocation]       = useState(null);    // Current { lat, lng }
  const [locationError,  setLocationError]  = useState(null);    // Error message or null
  const [locationStatus, setLocationStatus] = useState('idle');  // 'idle'|'locating'|'found'|'error'

  // ── Get Location ──────────────────────────────────────────────────────────
  // Requests the browser's Geolocation API. Falls back to REF_LOCATION if the
  // browser doesn't support geolocation or if the user denies permission.
  // Wrapped in useCallback for stable identity in the useEffect dependency array.
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      // Browser does not support the Geolocation API — use reference point
      setLocationError('Geolocation not supported by your browser');
      setLocationStatus('error');
      setLocation(REF_LOCATION);
      return;
    }

    setLocationStatus('locating'); // Show "Getting your location..." UI

    navigator.geolocation.getCurrentPosition(
      // Success callback — GPS coordinates acquired
      pos => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus('found');
        setLocationError(null);
      },
      // Error callback — permission denied or timeout
      () => {
        setLocationError('Location access denied - showing distances from reference point');
        setLocationStatus('error');
        setLocation(REF_LOCATION); // Fall back to Rajasinghe Road reference point
      },
      // Options: high accuracy, 10s timeout, accept 60s-old cached position
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  }, []);

  // ── Auto-request on Mount ─────────────────────────────────────────────────
  // Automatically requests location when the hook is first used.
  // Components can call getLocation() manually to re-request (e.g. a "Retry" button).
  useEffect(() => { getLocation(); }, [getLocation]);

  // ── distanceTo Helper ─────────────────────────────────────────────────────
  // Convenience method to compute distance from current location to a target.
  // Returns null if location has not yet been resolved.
  const distanceTo = (lat, lng) =>
    location ? haversine(location.lat, location.lng, lat, lng) : null;

  return {
    location,       // Current { lat, lng } or null
    locationError,  // Human-readable error string or null
    locationStatus, // 'idle' | 'locating' | 'found' | 'error'
    getLocation,    // Imperative re-request trigger
    distanceTo,     // distanceTo(lat, lng) → km number or null
    refLocation: REF_LOCATION, // Always-available reference point
  };
}
