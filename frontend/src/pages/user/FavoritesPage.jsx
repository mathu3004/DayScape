/**
 * pages/user/FavoritesPage.jsx — My Favourites
 *
 * Displays the authenticated user's saved favourite places in a 3-column
 * PlaceCard grid. Uses the onFavToggle callback to remove a card from the
 * list in real-time when the user un-favourites it.
 *
 * Data:
 *  favoriteAPI.getMy() — returns favorites array where each item has a
 *  populated 'place' field (full Place document with all required PlaceCard props)
 *
 * onFavToggle callback:
 *  Passed to each PlaceCard. When the user clicks the heart to un-favourite:
 *   - PlaceCard calls favoriteAPI.toggle() and gets { favorited: false }
 *   - PlaceCard calls onFavToggle(placeId, false)
 *   - handleFavToggle filters out the un-favourited place from local state
 *  This provides immediate UI feedback without re-fetching the full list.
 *
 * Empty state:
 *  Shows a ❤️ icon with "No favourites yet" and a hint to tap ♡ on place cards.
 */

import { useState, useEffect } from 'react';
import { favoriteAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import PlaceCard from '../../components/place/PlaceCard';
import styles from './User.module.css';

export default function FavoritesPage() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [favs, setFavs]       = useState([]);   // Array of favorite documents with populated place
  const [loading, setLoading] = useState(true);  // Initial fetch loading state
  const toast = useToast();

  // ── Fetch Favourites on Mount ─────────────────────────────────────────────
  // Each item in data.favorites has a 'place' property: the full Place document
  useEffect(() => { favoriteAPI.getMy().then(({ data }) => setFavs(data.favorites)).finally(() => setLoading(false)); }, []);

  // ── Handle Favourite Toggle (Un-favourite) ────────────────────────────────
  // Called by PlaceCard after a successful toggle API call.
  // When isFav becomes false, remove the card from the local list immediately.
  const handleFavToggle = (placeId, isFav) => {
    // Only act on un-favourite events (isFav === false)
    if (!isFav) setFavs(prev => prev.filter(f => f.place._id !== placeId));
  };

  return (
    <div className={styles.page}><div className="container">
      {/* Page title and divider */}
      <h1 className={styles.pageTitle}>My Favourites</h1><div className={styles.goldDiv}/>
      {/* Dynamic count of saved places */}
      <p style={{color:'var(--txt3)',marginBottom:'1.5rem'}}>{favs.length} saved place{favs.length!==1?'s':''}</p>
      {loading ? (
        // Loading spinner while fetching
        <div className="loading-center"><div className="spinner"/></div>
      ) :
        favs.length === 0 ? (
          // Empty state — hint to use the heart button on place cards
          <div className="empty-state"><div className="empty-state-icon">❤️</div><h3>No favourites yet</h3><p>Browse places and tap ♡ to save them here</p></div>
        ) : (
          // 3-column grid of PlaceCard components
          // f.place is the full Place document; onFavToggle removes cards in real-time
          <div className="grid-3">
            {favs.map(f => <PlaceCard key={f._id} place={f.place} onFavToggle={handleFavToggle}/>)}
          </div>
        )
      }
    </div></div>
  );
}
