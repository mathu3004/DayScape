/**
 * pages/LiveMapPage.jsx — Interactive Live Map
 *
 * Full-page interactive map built with React-Leaflet (Leaflet.js wrapper).
 * Shows all tourist attractions, two fixed landmarks (reference + airport),
 * the user's live GPS position, a 25 km radius circle, and optionally nearby
 * services (restaurants, fuel, hotels, police, hospitals).
 *
 * Fixed Coordinates:
 *  REF — 38 Rajasinghe Road, Dehiwala (reference location for all distances)
 *  BIA — Bandaranaike International Airport, Katunayake
 *
 * Map Icons (makeIcon factory):
 *  Creates a Leaflet DivIcon from an emoji + background colour + size.
 *  Returns a circular marker with a white border and drop shadow.
 *  ICONS map pre-builds icons for: place, user, ref, airport, and each service type.
 *
 * SVC_COLORS:
 *  Maps service type strings to hex colours used in dynamically created service icons.
 *
 * FlyTo component:
 *  An inner component that calls map.flyTo() whenever the center prop changes.
 *  Accepts zoom prop (default 14). flyTarget state in the parent controls this.
 *
 * PlacePopup component (inner):
 *  Rich popup card rendered inside the Leaflet Popup for tourist place markers.
 *  Contains: cover image, category, name, description, meta (distance + hours),
 *  entry fee, rating, and action buttons (View Details, + Plan, ♡ Save).
 *  Buttons redirect to /login for guest users (no alert()).
 *
 * Sidebar:
 *  Left panel with: location status card, category filter pills, nearby services
 *  toggle + type filter, and a scrollable list of all attractions.
 *
 * Map controls overlay (top-right of map area):
 *  Buttons to: toggle 25 km radius circle, fly to reference location,
 *  fly to airport, fly to user's GPS position.
 *
 * Map legend (bottom-right of map area):
 *  Colour-coded dot legend for attraction, user, reference, airport, services.
 *
 * Nearby services:
 *  Fetched from mapAPI.getNearby() when showNearby is true and GPS is available.
 *  Service markers are created dynamically with makeIcon using SVC_COLORS.
 */

import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Link, useNavigate } from 'react-router-dom';
import { placeAPI, mapAPI, favoriteAPI, planAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useLocation from '../hooks/useLocation';
import { haversine } from '../hooks/useLocation';
import styles from './LiveMapPage.module.css';

// ── Fixed coordinates ──────────────────────────────────────────
// REF: origin of all distance calculations when GPS is unavailable
const REF = { lat: 6.868671, lng: 79.860689, label: '38 Rajasinghe Road, Dehiwala' };
// BIA: Bandaranaike International Airport — displayed on the map for navigation context
const BIA = { lat: 7.180760, lng: 79.884100, label: 'Bandaranaike International Airport' };

// ── Custom icons ───────────────────────────────────────────────
// Factory function that creates a circular Leaflet DivIcon.
// bg: background colour (hex/css), emoji: the emoji rendered inside,
// size: diameter in pixels (default 28).
// popupAnchor: -size/2 ensures the popup opens above the marker centre.
const makeIcon = (bg, emoji, size = 28) => new L.DivIcon({
  html: `<div style="background:${bg};width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.5)}px;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${emoji}</div>`,
  iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2], className: '',
});

// ── Pre-built icon set for each marker type ───────────────────
// Keyed by type string — used via ICONS[type] in JSX.
const ICONS = {
  place:     makeIcon('#c9a84c', '📍', 30),   // Gold — tourist attractions
  user:      makeIcon('#1db87a', '•',  18),   // Teal dot — user's live GPS position
  ref:       makeIcon('#c9a84c', '🏠', 26),   // Gold house — reference location
  airport:   makeIcon('#5ba3e8', '✈', 28),    // Blue — BIA airport
  restaurant:makeIcon('#e05c4e', '🍽', 24),   // Red — restaurant nearby service
  fuel:      makeIcon('#888780', '⛽', 24),   // Grey — fuel station
  hotel:     makeIcon('#a89ee8', '🏨', 24),   // Purple — hotel
  police:    makeIcon('#4dc2e0', '🚓', 24),   // Cyan — police station
  hospital:  makeIcon('#1db87a', '🏥', 24),   // Teal — hospital
};

// ── Service type to hex colour map ────────────────────────────
// Used for dynamically creating service markers not in the ICONS preset.
const SVC_COLORS = { restaurant:'#e05c4e', fuel:'#888780', hotel:'#a89ee8', police:'#4dc2e0', hospital:'#1db87a' };

// ── FlyTo inner component ─────────────────────────────────────
// Calls Leaflet map.flyTo() whenever the center prop changes.
// useMap() hook accesses the Leaflet map instance from MapContainer context.
// zoom defaults to 14 (street-level); duration 1.2s for smooth pan+zoom.
function FlyTo({ center, zoom = 14 }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.2 }); }, [center]);
  return null;
}

// ── LiveMapPage ───────────────────────────────────────────────────────────────
export default function LiveMapPage() {
  // ── Context ───────────────────────────────────────────────────────────────
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  // location: { lat, lng } when GPS found; locationStatus: 'idle'|'locating'|'found'|'error'
  const { location, locationStatus, getLocation } = useLocation();

  // ── Map State ─────────────────────────────────────────────────────────────
  const [places, setPlaces] = useState([]);          // All tourist places
  const [nearby, setNearby] = useState([]);          // Nearby services (when visible)
  const [svcType, setSvcType] = useState('all');     // Nearby service type filter
  const [showNearby, setShowNearby] = useState(false); // Toggle nearby service markers
  const [showRadius, setShowRadius] = useState(true);  // Toggle 25 km radius circle
  const [flyTarget, setFlyTarget] = useState(null);    // [lat, lng] for FlyTo component
  const [flyZoom, setFlyZoom] = useState(14);          // Zoom level for FlyTo component
  const [selectedPlace, setSelectedPlace] = useState(null); // Currently highlighted place
  const [addingPlan, setAddingPlan] = useState(false);  // + Plan button loading state
  const [savingFav, setSavingFav] = useState(false);    // ♡ Save button loading state
  const [catFilter, setCatFilter] = useState('all');    // Category filter for place list + markers

  // ── Fetch All Places on Mount ─────────────────────────────────────────────
  // Load all 11 tourist places to populate the map and sidebar list.
  useEffect(() => {
    placeAPI.getAll({}).then(({ data }) => setPlaces(data.places));
  }, []);

  // ── Fetch Nearby Services When Toggled ───────────────────────────────────
  // Only fetches when GPS is available AND showNearby is true.
  // Re-fetches whenever the service type filter changes.
  useEffect(() => {
    if (location && showNearby) {
      mapAPI.getNearby({ lat: location.lat, lng: location.lng, type: svcType, radius: 15 })
        .then(({ data }) => setNearby(data.services));
    }
  }, [location, svcType, showNearby]);

  // ── Category Filter for Map and Sidebar ──────────────────────────────────
  // Build unique category slug list from loaded places for the filter buttons.
  const uniqueCats = ['all', ...new Set(places.map(p => p.category?.slug).filter(Boolean))];
  // Apply category filter — 'all' shows everything, others filter by category slug
  const filteredPlaces = catFilter === 'all' ? places : places.filter(p => p.category?.slug === catFilter);

  // ── Select Place from Sidebar List ───────────────────────────────────────
  // Sets the selected place and triggers a FlyTo animation on the map.
  const selectPlace = (place) => {
    setSelectedPlace(place);
    setFlyTarget([place.lat, place.lng]);
    setFlyZoom(15);  // Zoom in closer when selecting a specific place
  };

  // ── Add to Planner from Map Popup ─────────────────────────────────────────
  // Adds the selected place to sessionStorage 'plannerPlaces' array.
  // Redirects to /login if not authenticated.
  const handleAddToPlan = async () => {
    if (!user) { nav('/login'); return; }
    setAddingPlan(true);
    try {
      const existing = JSON.parse(sessionStorage.getItem('plannerPlaces') || '[]');
      // Prevent duplicates — only add if not already in the list
      if (!existing.find(p => p._id === selectedPlace._id)) {
        sessionStorage.setItem('plannerPlaces', JSON.stringify([...existing, selectedPlace]));
      }
      toast.success(`${selectedPlace.name} added to planner!`);
    } finally { setAddingPlan(false); }
  };

  // ── Toggle Favourite from Map Popup ──────────────────────────────────────
  // Calls favoriteAPI.toggle() for the selected place.
  // Redirects to /login for guest users.
  const handleFav = async () => {
    if (!user) { nav('/login'); return; }
    setSavingFav(true);
    try {
      const { data } = await favoriteAPI.toggle(selectedPlace._id);
      toast.success(data.message);
    } finally { setSavingFav(false); }
  };

  // ── Distance Display Helper ───────────────────────────────────────────────
  // Returns live GPS distance if available; falls back to server-stored reference distance.
  const getDist = (p) => location ? haversine(location.lat, location.lng, p.lat, p.lng) : p.distanceFromReference;

  // ── PlacePopup inner component ────────────────────────────────────────────
  // Rich card rendered inside the Leaflet Popup for each tourist place marker.
  // Accesses handleAddToPlan, handleFav, addingPlan, savingFav, user from closure.
  const PlacePopup = ({ place }) => {
    const dist = getDist(place);
    return (
      <div className={styles.placePopup}>
        {/* Place cover image — only shown if the place has one */}
        {place.coverImage && (
          <div className={styles.popupImg}>
            <img src={place.coverImage} alt={place.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          </div>
        )}
        <div className={styles.popupBody}>
          {/* Category name with icon */}
          <div className={styles.popupCat}>{place.category?.icon} {place.category?.name}</div>
          {/* Place name */}
          <div className={styles.popupName}>{place.name}</div>
          {/* Short description teaser */}
          <div className={styles.popupDesc}>{place.shortDescription}</div>
          {/* Meta row 1: distance + opening hours */}
          <div className={styles.popupMeta}>
            <span>📍 {typeof dist === 'number' ? dist.toFixed(1) : dist} km</span>
            <span>🕐 {place.openingTime}–{place.closingTime}</span>
          </div>
          {/* Meta row 2: entry type/price + rating */}
          <div className={styles.popupMeta}>
            {place.entryType === 'free'
              ? <span style={{ color:'#1db87a', fontWeight:600 }}>🆓 Free Entry</span>
              : <span style={{ color:'#c9a84c', fontWeight:600 }}>💰 LKR {place.tickets?.localAdult}</span>
            }
            <span>⭐ {(place.rating || 0).toFixed(1)}</span>
          </div>
          {/* Action buttons row */}
          <div className={styles.popupActions}>
            {/* View Details — always available, links to place detail page */}
            <Link to={`/place/${place.slug}`} className={styles.popupBtn} style={{ background:'var(--gold)', color:'#1a1200' }}>
              View Details
            </Link>
            {user ? (
              // Logged-in user: functional + Plan and ♡ Save buttons
              <>
                {/* + Plan button — adds to sessionStorage plannerPlaces */}
                <button className={styles.popupBtn} onClick={handleAddToPlan} disabled={addingPlan} style={{ background:'rgba(29,184,122,0.15)', color:'#1db87a', border:'1px solid rgba(29,184,122,0.3)' }}>
                  {addingPlan ? '...' : '+ Plan'}
                </button>
                {/* ♡ Save button — toggles favourite via API */}
                <button className={styles.popupBtn} onClick={handleFav} disabled={savingFav} style={{ background:'rgba(224,92,78,0.12)', color:'#e05c4e', border:'1px solid rgba(224,92,78,0.25)' }}>
                  {savingFav ? '...' : '♡ Save'}
                </button>
              </>
            ) : (
              // Guest view: sign-in prompts replace functional buttons
              <>
                <Link to="/login" className={styles.popupBtn} style={{ background:'rgba(29,184,122,0.1)', color:'#1db87a', border:'1px solid rgba(29,184,122,0.25)' }}>
                  🔑 Sign In to Plan
                </Link>
                <Link to="/login" className={styles.popupBtn} style={{ background:'rgba(224,92,78,0.08)', color:'#e05c4e', border:'1px solid rgba(224,92,78,0.2)' }}>
                  🔑 Sign In to Save
                </Link>
              </>
            )}
          </div>
          {/* Google Maps directions link — destination only (no origin needed) */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.popupMapsBtn}
          >
            🗺️ Open in Google Maps
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* ── SIDEBAR ──────────────────────────────────── */}
        {/* Left panel: location status, category filter, nearby services toggle, place list */}
        <aside className={styles.sidebar}>
          {/* ── Location Status Card ──────────────────── */}
          {/* Shows GPS status with coloured dot indicator and a refresh button */}
          <div className={styles.locCard}>
            <div className={styles.locRow}>
              {/* Dot colour: green=found, gold=locating, red=error/none */}
              <div className={`${styles.locDot} ${locationStatus === 'found' ? styles.dotGreen : locationStatus === 'locating' ? styles.dotGold : styles.dotRed}`} />
              <span className={styles.locTxt}>
                {locationStatus === 'found' ? '📍 Live location active' : locationStatus === 'locating' ? 'Detecting...' : 'Using reference point'}
              </span>
            </div>
            <button className="btn btn-ghost btn-sm btn-block" style={{ marginTop:'0.5rem' }} onClick={getLocation}>
              Refresh Location
            </button>
          </div>

          {/* ── Category Filter ──────────────────────── */}
          {/* Filters both the sidebar place list and the map markers simultaneously */}
          <div className={styles.filterCard}>
            <div className={styles.filterTitle}>Filter Attractions</div>
            <div className={styles.catBtns}>
              {uniqueCats.map(c => (
                <button
                  key={c}
                  className={`${styles.catBtn} ${catFilter === c ? styles.catBtnOn : ''}`}
                  onClick={() => setCatFilter(c)}
                >
                  {/* 'all' gets a map emoji; category slugs are formatted with spaces */}
                  {c === 'all' ? '🗺️ All' : c.replace(/-/g,' ')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Nearby Services Toggle ───────────────── */}
          {/* Toggle button shows/hides service markers on the map.
              When visible, a type filter is shown for specific service categories. */}
          <div className={styles.filterCard}>
            <div className={styles.filterTitle} style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Nearby Services</span>
              {/* Show/Hide toggle button — teal when active, ghost when hidden */}
              <button
                className={`btn btn-sm ${showNearby ? 'btn-teal' : 'btn-ghost'}`}
                style={{ padding:'2px 10px', fontSize:'0.72rem' }}
                onClick={() => setShowNearby(!showNearby)}
              >
                {showNearby ? 'Hide' : 'Show'}
              </button>
            </div>
            {/* Service type filter pills — only shown when nearby services are visible */}
            {showNearby && (
              <div className={styles.catBtns}>
                {['all','restaurant','fuel','hotel','police','hospital'].map(t => (
                  <button
                    key={t}
                    className={`${styles.catBtn} ${svcType === t ? styles.catBtnOn : ''}`}
                    onClick={() => setSvcType(t)}
                  >
                    {{ all:'🗺️ All', restaurant:'🍽️', fuel:'⛽', hotel:'🏨', police:'🚓', hospital:'🏥' }[t]} {t !== 'all' ? t : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Attractions List ─────────────────────── */}
          {/* Scrollable list of all filtered places. Clicking a place triggers
              selectPlace() which highlights it and flies the map to its location. */}
          <div className={styles.placeListCard}>
            <div className={styles.filterTitle}>{filteredPlaces.length} Attractions</div>
            <div className={styles.placeList}>
              {filteredPlaces.map(p => (
                <button
                  key={p._id}
                  // Active item gets .placeItemOn class for highlighted border
                  className={`${styles.placeItem} ${selectedPlace?._id === p._id ? styles.placeItemOn : ''}`}
                  onClick={() => selectPlace(p)}
                >
                  {/* Category icon */}
                  <span className={styles.placeItemIcon}>{p.category?.icon || '📍'}</span>
                  <span className={styles.placeItemInfo}>
                    <span className={styles.placeItemName}>{p.name}</span>
                    {/* Distance: live GPS or reference fallback */}
                    <span className={styles.placeItemDist}>
                      {location ? `${haversine(location.lat, location.lng, p.lat, p.lng).toFixed(1)} km from you` : `${p.distanceFromReference} km from ref.`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── MAP AREA ──────────────────────────────────────── */}
        {/* Full-height MapContainer from React-Leaflet. Initial center is
            approximately central Colombo; zoom 12 shows most of the coverage area. */}
        <div className={styles.mapWrap}>
          <MapContainer
            center={[6.905, 79.870]}  // Central Colombo coordinates
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            {/* OpenStreetMap tile layer — free, no API key required */}
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {/* FlyTo component — triggers animated pan+zoom when flyTarget is set */}
            {flyTarget && <FlyTo center={flyTarget} zoom={flyZoom} />}

            {/* ── Reference location: 38 Rajasinghe Road ── */}
            {/* Gold house marker — popup shows address and coordinates */}
            <Marker position={[REF.lat, REF.lng]} icon={ICONS.ref}>
              <Popup maxWidth={220}>
                <div className={styles.simplePopup}>
                  <strong>🏠 Reference Location</strong>
                  <p>{REF.label}</p>
                  {/* Coordinates displayed for transparency */}
                  <p style={{ fontSize:'0.72rem', color:'#888' }}>Lat: {REF.lat} · Lng: {REF.lng}</p>
                  <p style={{ fontSize:'0.75rem' }}>25 km radius origin point</p>
                </div>
              </Popup>
            </Marker>

            {/* ── Airport: BIA ── */}
            {/* Blue plane marker — popup shows IATA code and optional live distance */}
            <Marker position={[BIA.lat, BIA.lng]} icon={ICONS.airport}>
              <Popup maxWidth={240}>
                <div className={styles.simplePopup}>
                  <strong>✈️ {BIA.label}</strong>
                  <p>Katunayake, Gampaha District</p>
                  <p style={{ fontSize:'0.75rem' }}>IATA: CMB · International departures & arrivals</p>
                  {/* Live distance from user's GPS to airport — only shown when GPS is active */}
                  {location && (
                    <p style={{ fontSize:'0.75rem', color:'#5ba3e8', fontWeight:600 }}>
                      {haversine(location.lat, location.lng, BIA.lat, BIA.lng).toFixed(1)} km from your location
                    </p>
                  )}
                  {/* Google Maps directions link to the airport */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${BIA.lat},${BIA.lng}&travelmode=driving`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display:'block', marginTop:'6px', fontSize:'0.75rem', color:'#5ba3e8' }}
                  >
                    🗺️ Directions to Airport
                  </a>
                </div>
              </Popup>
            </Marker>

            {/* ── User live location ── */}
            {/* Teal dot marker — only shown when GPS is actively found.
                The 25 km radius circle is anchored on REF (not the user). */}
            {location && locationStatus === 'found' && (
              <>
                {/* Small green dot at the user's current GPS coordinates */}
                <Marker position={[location.lat, location.lng]} icon={ICONS.user}>
                  <Popup maxWidth={180}>
                    <div className={styles.simplePopup}>
                      <strong style={{ color:'#1db87a' }}>📍 Your Location</strong>
                      <p>Live GPS position</p>
                    </div>
                  </Popup>
                </Marker>
                {/* 25 km radius circle centred on REF — shown when showRadius is true.
                    Dashed stroke with very low fill opacity for a subtle visual indicator. */}
                {showRadius && (
                  <Circle
                    center={[REF.lat, REF.lng]}
                    radius={25000}
                    pathOptions={{ color:'#c9a84c', fillColor:'#c9a84c', fillOpacity:0.04, weight:1, dashArray:'6,4' }}
                  />
                )}
              </>
            )}

            {/* ── Tourist place markers ── */}
            {/* One gold pin marker per filtered place. Clicking opens the PlacePopup.
                eventHandlers.click also sets selectedPlace to highlight the sidebar item. */}
            {filteredPlaces.map(p => (
              <Marker
                key={p._id}
                position={[p.lat, p.lng]}
                icon={ICONS.place}
                eventHandlers={{ click: () => setSelectedPlace(p) }}
              >
                <Popup maxWidth={280} maxHeight={440}>
                  {/* Rich PlacePopup card with actions */}
                  <PlacePopup place={p} />
                </Popup>
              </Marker>
            ))}

            {/* ── Nearby service markers ── */}
            {/* Only rendered when showNearby is true. Each service marker is
                created dynamically with makeIcon using the SVC_COLORS colour map. */}
            {showNearby && nearby.map((svc, i) => (
              <Marker
                key={i}
                position={[svc.lat, svc.lng]}
                icon={makeIcon(SVC_COLORS[svc.type] || '#888', { restaurant:'🍽', fuel:'⛽', hotel:'🏨', police:'🚓', hospital:'🏥' }[svc.type] || '📍', 24)}
              >
                <Popup maxWidth={220}>
                  <div className={styles.simplePopup}>
                    {/* Service name */}
                    <strong>{svc.name}</strong>
                    {/* Service address */}
                    <p>{svc.address}</p>
                    {/* Distance and open status */}
                    <p>📏 {svc.distance} km away · {svc.open}</p>
                    {/* Optional Google rating */}
                    {svc.rating && <p>⭐ {svc.rating}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* ── Map Control Overlay ────────────────────────────── */}
          {/* Positioned over the map (top-right). Buttons trigger flyTo animations. */}
          <div className={styles.mapControls}>
            {/* Toggle 25 km radius circle visibility */}
            <button
              className={`${styles.mapBtn} ${showRadius ? styles.mapBtnOn : ''}`}
              onClick={() => setShowRadius(!showRadius)}
            >
              {showRadius ? '◉' : '○'} 25 km radius
            </button>
            {/* Fly to reference location */}
            <button className={styles.mapBtn} onClick={() => { setFlyTarget([REF.lat, REF.lng]); setFlyZoom(13); }}>
              🏠 Reference
            </button>
            {/* Fly to airport */}
            <button className={styles.mapBtn} onClick={() => { setFlyTarget([BIA.lat, BIA.lng]); setFlyZoom(13); }}>
              ✈️ Airport
            </button>
            {/* Fly to user's GPS position — only shown when GPS is active */}
            {location && locationStatus === 'found' && (
              <button className={styles.mapBtn} onClick={() => { setFlyTarget([location.lat, location.lng]); setFlyZoom(14); }}>
                📍 My Location
              </button>
            )}
          </div>

          {/* ── Map Legend ─────────────────────────────────────── */}
          {/* Bottom-right overlay explaining what each dot colour represents */}
          <div className={styles.legend}>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background:'#c9a84c' }} />Attraction</div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background:'#1db87a' }} />You</div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background:'#c9a84c', opacity:0.7 }} />Reference</div>
            <div className={styles.legendItem}><div className={styles.legendDot} style={{ background:'#5ba3e8' }} />Airport</div>
            {/* Services legend item — only visible when nearby services are shown */}
            {showNearby && <div className={styles.legendItem}><div className={styles.legendDot} style={{ background:'#e05c4e' }} />Services</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
