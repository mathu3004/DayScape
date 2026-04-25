/**
 * pages/ExplorePage.jsx — Browse All Attractions
 *
 * Displays a searchable, filterable grid of all tourist places. Supports
 * four simultaneous filter dimensions: text search, category, sort order,
 * and entry fee type. Filters are debounced (300 ms) to avoid excessive
 * API requests while the user is typing.
 *
 * URL sync:
 *  searchParams are read on mount so that external links like
 *  /explore?cat=park-recreational pre-populate the category filter.
 *
 * Filters:
 *  search      — partial-match text against place name / description
 *  selectedCat — MongoDB _id of a category document (empty = all)
 *  sort        — nearest | rating | popularity | name
 *  entryType   — free | paid | '' (all)
 *
 * Live GPS integration:
 *  When location is available, lat/lng are forwarded to the API so the
 *  server can sort by live distance. getLiveDist() computes real-time
 *  Haversine distance passed to each PlaceCard as liveDistance.
 *
 * useCallback + useEffect debounce pattern:
 *  fetchPlaces is wrapped in useCallback so React only recreates it when
 *  its dependencies change. The useEffect wraps it in a 300 ms setTimeout,
 *  cancelling the previous timer on every re-render (clearTimeout cleanup).
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { placeAPI, categoryAPI } from '../services/api';
import PlaceCard from '../components/place/PlaceCard';
import useLocation from '../hooks/useLocation';
import { haversine } from '../hooks/useLocation';
import styles from './ExplorePage.module.css';

export default function ExplorePage() {
  // ── Filter State ──────────────────────────────────────────────────────────
  const [places, setPlaces] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // searchParams: read URL query string on mount to support deep-linking
  // e.g. /explore?category=<id> or /explore?search=keyword
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [selectedCat, setSelectedCat] = useState(searchParams.get('category') || '');

  // Sort order — default to nearest first; options: nearest, rating, popularity, name
  const [sort, setSort] = useState('nearest');

  // Entry fee filter — empty string means "show all"
  const [entryType, setEntryType] = useState('');

  // GPS location state from custom useLocation hook
  const { location, locationStatus, getLocation } = useLocation();

  // ── Fetch Places (debounced) ──────────────────────────────────────────────
  // Builds the query params object from current filter state and calls placeAPI.getAll().
  // Passes lat/lng when GPS is available so the server sorts by actual live distance.
  const fetchPlaces = useCallback(async () => {
    setLoading(true);
    try {
      // Build API query params — only include fields that have values
      const params = { sort };
      if (selectedCat) params.category = selectedCat;
      if (search) params.search = search;
      if (entryType) params.entryType = entryType;
      // Include user's live coordinates so server can compute/sort by live distance
      if (location) { params.lat = location.lat; params.lng = location.lng; }
      const { data } = await placeAPI.getAll(params);
      setPlaces(data.places);
    } finally { setLoading(false); }
  }, [selectedCat, search, sort, entryType, location]);

  // ── Fetch Categories Once on Mount ───────────────────────────────────────
  // Categories are static seed data — fetched once and never re-fetched.
  useEffect(() => { categoryAPI.getAll().then(({ data }) => setCategories(data.categories)); }, []);

  // ── Debounced Places Fetch ────────────────────────────────────────────────
  // 300 ms debounce: delays the API call while the user is still typing/clicking.
  // clearTimeout in the cleanup cancels the pending call when dependencies change again.
  useEffect(() => { const t = setTimeout(fetchPlaces, 300); return () => clearTimeout(t); }, [fetchPlaces]);

  // ── Live Distance Helper ──────────────────────────────────────────────────
  // Returns Haversine distance in km from user GPS to a place, or null if no GPS.
  const getLiveDist = (place) => location ? haversine(location.lat, location.lng, place.lat, place.lng) : null;

  // ── Clear All Filters ─────────────────────────────────────────────────────
  // Resets all four filter dimensions to their default "show all" values.
  const clearFilters = () => { setSearch(''); setSelectedCat(''); setSort('nearest'); setEntryType(''); };

  return (
    <div className={styles.page}>
      <div className="container">
        {/* ── Page Header ───────────────────────────────────────────────── */}
        {/* Shows count of results + GPS status on the right */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Explore Attractions</h1>
            <div className="gold-divider"/>
            {/* Dynamic sub-text: show live location note when GPS is active */}
            <p className={styles.sub}>
              {places.length} attraction{places.length !== 1 ? 's' : ''} within a 25 km of the reference location
              {locationStatus === 'found' && ' · Sorted by live distance from your current location'}
            </p>
          </div>
          {/* GPS status indicator with coloured dot and refresh button */}
          <div className={styles.locStatus}>
            <div className={`${styles.dot} ${locationStatus === 'found' ? styles.dotGreen : locationStatus === 'locating' ? styles.dotGold : styles.dotRed}`}/>
            <span className={styles.locTxt}>
              {locationStatus === 'found' ? 'Live location active' : locationStatus === 'locating' ? 'Detecting...' : 'Using reference point'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={getLocation}>📍 Refresh</button>
          </div>
        </div>

        {/* ── Two-column layout: sidebar filters + results grid ─────────── */}
        <div className={styles.layout}>
          {/* ── Sidebar Filters ──────────────────────────────────────── */}
          <aside className={styles.sidebar}>

            {/* Search filter — text input, triggers debounced fetchPlaces */}
            <div className={styles.filterCard}>
              <div className={styles.filterTitle}>Search</div>
              <input
                className="form-input" type="text" placeholder="Search places..."
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Category filter — shows "All Places" + one button per category */}
            {/* Clicking an already-selected category deselects it (toggle) */}
            <div className={styles.filterCard}>
              <div className={styles.filterTitle}>Category</div>
              <div className={styles.catList}>
                {/* "All Places" is the deselect option (sets selectedCat to empty) */}
                <button className={`${styles.catBtn} ${selectedCat === '' ? styles.catActive : ''}`} onClick={() => setSelectedCat('')}>
                  🗺️ All Places
                </button>
                {/* Render one button per category document from the database */}
                {categories.map(c => (
                  <button key={c._id} className={`${styles.catBtn} ${selectedCat === c._id ? styles.catActive : ''}`}
                    onClick={() => setSelectedCat(selectedCat === c._id ? '' : c._id)}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort order selector — nearest | rating | popularity | A-Z */}
            <div className={styles.filterCard}>
              <div className={styles.filterTitle}>Sort By</div>
              <select className="form-input form-select" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="nearest">Nearest First</option>
                <option value="rating">Top Rated</option>
                <option value="popularity">Most Popular</option>
                <option value="name">A – Z</option>
              </select>
            </div>

            {/* Entry fee filter — all | free | paid */}
            <div className={styles.filterCard}>
              <div className={styles.filterTitle}>Entry Fee</div>
              <div className={styles.catList}>
                <button className={`${styles.catBtn} ${entryType === '' ? styles.catActive : ''}`} onClick={() => setEntryType('')}>All</button>
                <button className={`${styles.catBtn} ${entryType === 'free' ? styles.catActive : ''}`} onClick={() => setEntryType('free')}>🆓 Free Entry</button>
                <button className={`${styles.catBtn} ${entryType === 'paid' ? styles.catActive : ''}`} onClick={() => setEntryType('paid')}>💰 Paid Entry</button>
              </div>
            </div>

            {/* Clear Filters button — only shown when any non-default filter is active */}
            {(search || selectedCat || entryType) && (
              <button className="btn btn-outline btn-sm btn-block" onClick={clearFilters}>✕ Clear Filters</button>
            )}
          </aside>

          {/* ── Results Grid ─────────────────────────────────────────── */}
          <div className={styles.results}>
            {loading ? (
              // Loading state: spinner + text
              <div className="loading-center"><div className="spinner"/><p style={{color:'var(--txt3)'}}>Loading attractions...</p></div>
            ) : places.length === 0 ? (
              // Empty state: no results matching current filters
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3>No places found</h3>
                <p>Try adjusting your filters or search term</p>
                <button className="btn btn-ghost" style={{marginTop:'1rem'}} onClick={clearFilters}>Clear Filters</button>
              </div>
            ) : (
              // Results: 3-column PlaceCard grid with live distance passed to each card
              <div className="grid-3">
                {places.map(place => (
                  <PlaceCard key={place._id} place={place} liveDistance={getLiveDist(place)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
