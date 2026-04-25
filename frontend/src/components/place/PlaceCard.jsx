/**
 * components/place/PlaceCard.jsx — Tourist Place Listing Card
 *
 * Reusable card component displayed in the Explore page grid and other
 * place listing contexts. Renders the place image, category badge, name,
 * description, star rating, entry price, and two action buttons.
 *
 * Props:
 *  place        {object}   — Place document (name, slug, coverImage, category,
 *                            shortDescription, rating, reviewCount, entryType,
 *                            tickets, distanceFromReference, isFeatured, crowd)
 *  liveDistance {number?}  — Real-time Haversine distance from user's GPS position.
 *                            Falls back to place.distanceFromReference if null.
 *  onFavToggle  {function?}— Optional callback: (placeId, isFavorited) → void.
 *                            Called after a successful favourite toggle so parent
 *                            components can update their local state.
 *
 * Action buttons:
 *  Heart (❤️/🤍) — Toggle favourite. Redirects to /login if not authenticated.
 *  + Plan        — Add the place to the PlannerPage via sessionStorage.
 *                  Redirects to /login if not authenticated.
 *                  Redirects to /planner if the place is already in the list.
 *
 * sessionStorage key 'plannerPlaces':
 *  An array of place objects persisted in sessionStorage so they survive
 *  navigation to /planner. The PlannerPage reads this array on mount and
 *  pre-populates the planner with the accumulated places.
 *
 * Distance display:
 *  liveDistance (if provided) is shown to 1 decimal place.
 *  Falls back to place.distanceFromReference (pre-calculated on the server).
 *
 * Entry price:
 *  Free places show a teal "Free" badge.
 *  Paid places show a gold badge with the local adult ticket price in LKR.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { favoriteAPI } from '../../services/api';
import { useAuth }     from '../../context/AuthContext';
import { useToast }    from '../../context/ToastContext';
import styles from './PlaceCard.module.css';

export default function PlaceCard({ place, liveDistance, onFavToggle }) {
  const { user } = useAuth();   // Check if user is logged in for auth-gated actions
  const toast    = useToast();  // Toast notifications for success/error/info
  const nav      = useNavigate();

  const [favLoading, setFavLoading] = useState(false); // Prevents double-clicks on heart
  const [isFav,      setIsFav]      = useState(false); // Local favourite state for this card

  // ── Distance Display ──────────────────────────────────────────────────────
  // Use the live GPS-based distance when available; fall back to the stored
  // reference distance (calculated from 38 Rajasinghe Road at seed time).
  const dist = liveDistance != null
    ? parseFloat(liveDistance).toFixed(1)
    : place.distanceFromReference;

  // ── Handle Favourite Toggle ───────────────────────────────────────────────
  // Prevents the card's Link navigation (e.preventDefault).
  // Redirects to /login if the user is not authenticated (no alert shown).
  // On success, updates local isFav state and calls the parent onFavToggle callback.
  const handleFav = async (e) => {
    e.preventDefault(); // Stop the card Link from navigating to the place detail page
    // No alert - redirect cleanly
    if (!user) { nav('/login'); return; }

    setFavLoading(true);
    try {
      const { data } = await favoriteAPI.toggle(place._id);
      setIsFav(data.favorited);
      toast.success(data.message);
      // Notify parent component (e.g. FavoritesPage) that the state changed
      if (onFavToggle) onFavToggle(place._id, data.favorited);
    } catch {
      toast.error('Failed to update favourites');
    } finally {
      setFavLoading(false);
    }
  };

  // ── Handle Add to Planner ─────────────────────────────────────────────────
  // Stores the place in sessionStorage under 'plannerPlaces' so PlannerPage
  // can pick it up when the user navigates there.
  // Redirects to /login if not authenticated.
  // Shows a toast and navigates to /planner if the place is already in the list.
  const handleAddToPlan = (e) => {
    e.preventDefault(); // Prevent the card Link from navigating
    if (!user) { nav('/login'); return; }

    const existing = JSON.parse(sessionStorage.getItem('plannerPlaces') || '[]');
    if (existing.find(p => p._id === place._id)) {
      // Already in the planner — navigate there instead of adding a duplicate
      toast.info('Already in planner - open Trip Planner to view');
      nav('/planner');
      return;
    }

    // Add this place to the sessionStorage planner list and confirm to the user
    sessionStorage.setItem('plannerPlaces', JSON.stringify([...existing, place]));
    toast.success(`${place.name} added to planner!`);
  };

  // ── Star Rating ───────────────────────────────────────────────────────────
  // Round the float rating to the nearest integer for the ★/☆ display.
  const stars = Math.round(place.rating || 0);

  // Crowd level label map (not currently used in all places but ready for future data)
  const CROWD = { low: '🟢 Low', mid: '🟡 Moderate', high: '🔴 Busy' };

  return (
    // Entire card is a Link — clicking anywhere navigates to /place/:slug
    <Link to={`/place/${place.slug}`} className={styles.card}>

      {/* ── Image Section ──────────────────────────────────────────────── */}
      <div className={styles.imgWrap}>
        {/* Cover image with lazy loading; fallback to a generic beach photo */}
        <img
          src={place.coverImage || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600'}
          alt={place.name}
          className={styles.img}
          loading="lazy"
        />

        {/* Distance badge — bottom-left of image */}
        <div className={styles.distBadge}>{dist} km</div>

        {/* Crowd level badge — only rendered if place.crowd is set */}
        {place.crowd && (
          <div className={`${styles.crowdBadge} ${styles[`crowd_${place.crowd}`]}`}>
            {CROWD[place.crowd] || CROWD.low}
          </div>
        )}

        {/* Favourite heart button — top-right of image */}
        {/* Fav button - no alert, redirect if guest */}
        <button
          className={`${styles.favBtn} ${isFav ? styles.favBtnOn : ''}`}
          onClick={handleFav}
          disabled={favLoading}
          title={user ? 'Save to favourites' : 'Sign in to save'}
          aria-label="Save to favourites"
        >
          {isFav ? '❤️' : '🤍'}
        </button>

        {/* Featured badge — only shown when place.isFeatured is true */}
        {place.isFeatured && (
          <div className={styles.featBadge}>⭐ Featured</div>
        )}
      </div>

      {/* ── Card Body ──────────────────────────────────────────────────── */}
      <div className={styles.body}>

        {/* Category row: emoji icon + category name */}
        <div className={styles.catRow}>
          <span>{place.category?.icon || '📍'}</span>
          <span className={styles.catName}>{place.category?.name || 'Attraction'}</span>
        </div>

        {/* Place name headline */}
        <h3 className={styles.name}>{place.name}</h3>

        {/* One-sentence teaser description */}
        <p className={styles.desc}>{place.shortDescription}</p>

        {/* Star rating display + numeric score + review count */}
        <div className={styles.ratingRow}>
          <span className="stars">
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </span>
          <span className={styles.ratingNum}>{(place.rating || 0).toFixed(1)}</span>
          <span className={styles.reviewCount}>({place.reviewCount || 0})</span>
        </div>

        {/* ── Card Footer: Entry badge + Plan button ────────────────── */}
        <div className={styles.footer}>
          <div className={styles.entryBadge}>
            {place.entryType === 'free'
              ? <span className="badge badge-teal">Free</span>
              // Show local adult ticket price for paid attractions
              : <span className="badge badge-gold">LKR {place.tickets?.localAdult?.toLocaleString() || '-'}</span>
            }
          </div>

          {/* Add to Planner button — key icon shown if not logged in */}
          {/* Plan button - no alert */}
          <button
            className={`btn btn-sm ${styles.planBtn}`}
            onClick={handleAddToPlan}
            title={user ? 'Add to day plan' : 'Sign in to plan'}
          >
            {user ? '+ Plan' : '🔑 Plan'}
          </button>
        </div>

      </div>
    </Link>
  );
}
