import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { bookingAPI } from '../../services/api';
import { exportPlanToPDF } from '../../utils/pdfExport';
import styles from './BookingDetail.module.css';

const REF = { lat: 6.868671, lng: 79.860689 };

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return parseFloat((R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))).toFixed(2));
}

function buildMapsUrl(places, uLat, uLng) {
  const valid = (places||[]).filter(p => p?.lat);
  if (!valid.length) return null;
  const origin = uLat ? `${uLat},${uLng}` : `${REF.lat},${REF.lng}`;
  const dest   = `${valid[valid.length-1].lat},${valid[valid.length-1].lng}`;
  const wps    = valid.slice(0,-1).map(p=>`${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${wps?`&waypoints=${wps}`:''}&travelmode=driving`;
}

const TRANSPORT = [
  { mode:'car',   label:'Car / Taxi', icon:'Car',   speedKmh:25, base:100, perKm:50,  apps:['PickMe','Uber'] },
  { mode:'tuk',   label:'Tuk-tuk',    icon:'Tuk',   speedKmh:20, base:60,  perKm:40,  apps:['PickMe'] },
  { mode:'bus',   label:'City Bus',   icon:'Bus',   speedKmh:15, base:15,  perKm:3,   apps:[] },
  { mode:'train', label:'Train',      icon:'Train', speedKmh:30, base:10,  perKm:2,   apps:[] },
  { mode:'walk',  label:'Walking',    icon:'Walk',  speedKmh:5,  base:0,   perKm:0,   apps:[] },
];

const ICONS = { Car:'🚗', Tuk:'🛺', Bus:'🚌', Train:'🚂', Walk:'🚶' };

export default function BookingDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    bookingAPI.getOne(id).then(({ data }) => setBooking(data.booking)).finally(() => setLoading(false));
    navigator.geolocation?.getCurrentPosition(
      p => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setUserLoc(REF)
    );
  }, [id]);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!booking) return (
    <div className="container" style={{ padding:'4rem 0', textAlign:'center' }}>
      <h2>Booking not found</h2>
      <Link to="/bookings" className="btn btn-gold" style={{ marginTop:'1rem' }}>My Bookings</Link>
    </div>
  );

  // Collect all places
  const isPackage = booking.bookingType === 'package';
  const isPlanBkg = booking.bookingType === 'plan';
  const isCartBkg = booking.bookingType === 'cart';

  let places = [];
  if (isPackage) {
    places = booking.package?.places || [];
  } else if (isPlanBkg) {
    places = (booking.plan?.places || []).sort((a,b) => a.order - b.order).map(s => s.place).filter(Boolean);
  } else if (isCartBkg) {
    // Collect all places from every cart item's package or plan
    (booking.cartItems || []).forEach(ci => {
      if (ci.package?.places?.length) {
        places.push(...ci.package.places);
      } else if (ci.plan?.places?.length) {
        places.push(...(ci.plan.places).sort((a,b)=>a.order-b.order).map(s=>s.place).filter(Boolean));
      }
    });
  }

  const mapsUrl = buildMapsUrl(places, userLoc?.lat, userLoc?.lng);

  let totalDist = 0;
  if (userLoc && places[0]?.lat) totalDist += haversine(userLoc.lat, userLoc.lng, places[0].lat, places[0].lng);
  for (let i = 0; i < places.length - 1; i++) {
    if (places[i]?.lat && places[i+1]?.lat) totalDist += haversine(places[i].lat, places[i].lng, places[i+1].lat, places[i+1].lng);
  }
  totalDist = parseFloat(totalDist.toFixed(1));

  const transport = TRANSPORT.map(m => {
    const mins = Math.round((totalDist / m.speedKmh) * 60);
    const cost = m.perKm === 0 ? 0 : Math.round(m.base + totalDist * m.perKm);
    return { ...m, mins, cost };
  });

  const STATUS_COLOR = { confirmed:'teal', pending:'gold', cancelled:'coral', completed:'blue' };

  const handleCompletePayment = () => {
    nav('/payment', {
      state: {
        mode: booking.bookingType || 'package',
        existingBooking: booking,
        pkg:       booking.package  || undefined,
        packageId: booking.package?._id,
        plan:      booking.plan     || undefined,
        planId:    booking.plan?._id,
      }
    });
  };

  // PDF data builders
  const planForPDF = isPlanBkg && booking.plan ? {
    name: booking.plan.name,
    places: (booking.plan.places || []).sort((a,b) => a.order - b.order),
    estimatedTotalCost: booking.plan.estimatedTotalCost,
  } : null;

  // Package → wrap each place into the {place, visitTime, duration} shape the PDF util expects
  const packageForPDF = isPackage && booking.package && places.length > 0 ? {
    name: booking.package.name,
    places: places.map(p => ({ place: p, visitTime: p.openingTime || '', duration: p.estimatedDuration || '', notes: '' })),
    estimatedTotalCost: null,
  } : null;

  // Cart → collect all places already in the `places` array
  const cartForPDF = isCartBkg && places.length > 0 ? {
    name: `Cart Booking – ${new Date(booking.visitDate).toLocaleDateString('en-GB')}`,
    places: places.map(p => ({ place: p, visitTime: p.openingTime || '', duration: p.estimatedDuration || '', notes: '' })),
    estimatedTotalCost: booking.totalAmount,
  } : null;

  return (
    <div className={styles.page}>
      <div className="container">
        <div style={{ marginBottom:'1rem' }}>
          <Link to="/bookings" style={{ fontSize:'0.85rem', color:'var(--gold3)' }}>← My Bookings</Link>
        </div>

        <div className={styles.layout}>
          {/* ── LEFT ── */}
          <div className={styles.left}>
            {/* Booking header */}
            <div className="card" style={{ marginBottom:'1rem' }}>
              <div className={styles.bookingHd}>
                <div>
                  <div style={{ fontSize:'0.72rem', color:'var(--txt3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>Booking Reference</div>
                  <div className={styles.bookingRef}>{booking.bookingRef}</div>
                  <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginTop:'0.65rem' }}>
                    <span className={`badge badge-${STATUS_COLOR[booking.status] || 'gold'}`}>{booking.status}</span>
                    {isPackage && <span className="badge badge-gold">📦 Package</span>}
                    {isPlanBkg && <span className="badge badge-blue">🗓️ Day Plan</span>}
                    {isCartBkg && <span className="badge badge-gold">🛒 Cart</span>}
                    {booking.isPaid && <span className="badge badge-teal">✓ Paid</span>}
                  </div>
                </div>
                <div className={styles.bookingAmount}>
                  <div style={{ fontSize:'0.72rem', color:'var(--txt3)', marginBottom:'4px' }}>Amount</div>
                  <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.6rem', fontWeight:700, color:'var(--gold)' }}>LKR {booking.totalAmount?.toLocaleString()}</div>
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoBox}>
                  <div className={styles.infoL}>Package / Plan</div>
                  <div className={styles.infoV}>
                    {isCartBkg
                      ? `${booking.cartItems?.length || 0} item${booking.cartItems?.length !== 1 ? 's' : ''} (cart)`
                      : booking.package?.name || booking.plan?.name || '-'}
                  </div>
                </div>
                <div className={styles.infoBox}><div className={styles.infoL}>Visit Date</div><div className={styles.infoV}>{new Date(booking.visitDate).toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div></div>
                <div className={styles.infoBox}><div className={styles.infoL}>Guests</div><div className={styles.infoV}>{booking.adults} adult{booking.adults>1?'s':''}{booking.children>0?`, ${booking.children} child${booking.children>1?'ren':''}`:''}</div></div>
                <div className={styles.infoBox}><div className={styles.infoL}>Booked On</div><div className={styles.infoV}>{new Date(booking.createdAt || booking.bookingDate).toLocaleDateString('en-GB')}</div></div>
              </div>
            </div>

            {/* Stops */}
            {places.length > 0 && (
              <div className="card" style={{ marginBottom:'1rem' }}>
                <h3 className={styles.sectionTitle}>Trip Stops</h3>
                <div className={styles.stopList}>
                  {places.map((place, i) => (
                    <div key={place?._id || i}>
                      <div className={styles.stop}>
                        <div className={styles.stopNum}>{i + 1}</div>
                        {place?.coverImage && <div className={styles.stopImg}><img src={place.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'var(--radius)' }} /></div>}
                        <div className={styles.stopInfo}>
                          <div className={styles.stopName}>{place?.name || 'Place'}</div>
                          <div className={styles.stopMeta}>
                            {place?.openingTime && <span>🕐 {place.openingTime}–{place.closingTime}</span>}
                            {place?.distanceFromReference && <span>📍 {place.distanceFromReference} km from ref.</span>}
                            {place?.estimatedDuration && <span>⏱ {place.estimatedDuration}</span>}
                          </div>
                        </div>
                        {place?.slug && <Link to={`/place/${place.slug}`} className="btn btn-ghost btn-sm" style={{ flexShrink:0 }}>View</Link>}
                      </div>
                      {i < places.length - 1 && <div style={{ textAlign:'center', color:'var(--txt4)', fontSize:'0.8rem', padding:'0.2rem 0 0.2rem 40px' }}>↓ travel to next stop</div>}
                    </div>
                  ))}
                </div>
                <div className={styles.tripSummary}>
                  <div className={styles.summaryItem}><span className={styles.sLabel}>Stops</span><span className={styles.sVal}>{places.length}</span></div>
                  <div className={styles.summaryItem}><span className={styles.sLabel}>Est. Distance</span><span className={styles.sVal}>{totalDist} km</span></div>
                  <div className={styles.summaryItem}><span className={styles.sLabel}>Est. Time</span><span className={styles.sVal}>~{(places.length * 1.5).toFixed(1)} hrs</span></div>
                </div>
              </div>
            )}

            {/* Cart — compact order summary above Trip Stops */}
            {isCartBkg && booking.cartItems?.length > 0 && (
              <div className="card" style={{ marginBottom:'1rem', padding:'0.85rem 1.1rem' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--txt4)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.6rem' }}>Order Summary</div>
                {booking.cartItems.map((ci, i) => (
                  <div key={ci._id || i} style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.45rem 0', borderBottom: i < booking.cartItems.length - 1 ? '1px solid var(--brd)' : 'none' }}>
                    {ci.package?.coverImage && (
                      <div style={{ width:44, height:38, borderRadius:'var(--radius)', overflow:'hidden', flexShrink:0 }}>
                        <img src={ci.package.coverImage} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                      </div>
                    )}
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'0.85rem', fontWeight:600, color:'var(--txt)' }}>{ci.name || ci.package?.name || ci.plan?.name || 'Item'}</div>
                      <div style={{ fontSize:'0.74rem', color:'var(--txt3)' }}>
                        👥 {ci.adults} adult{ci.adults > 1 ? 's' : ''}{ci.children > 0 ? ` · ${ci.children} child${ci.children > 1 ? 'ren' : ''}` : ''}
                        {ci.price > 0 && <span style={{ marginLeft:'0.5rem' }}>· LKR {ci.price.toLocaleString()} / adult</span>}
                      </div>
                    </div>
                    <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1rem', color:'var(--gold)', fontWeight:700, flexShrink:0 }}>
                      LKR {Math.round(ci.price * (ci.adults + ci.children * 0.5)).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transport - only shown for paid bookings */}
            {booking.isPaid && totalDist > 0 && (
              <div className="card" style={{ marginBottom:'1rem' }}>
                <h3 className={styles.sectionTitle}>Travel Options</h3>
                <p style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'1rem' }}>Estimated for {totalDist} km total trip distance.</p>
                <div className={styles.modeGrid}>
                  {transport.map(m => (
                    <div key={m.mode} className={styles.modeCard}>
                      <div className={styles.modeIcon}>{ICONS[m.icon]}</div>
                      <div className={styles.modeLabel}>{m.label}</div>
                      <div className={styles.modeDur}>{m.mins < 60 ? `${m.mins} min` : `${Math.floor(m.mins/60)}h ${m.mins%60}m`}</div>
                      <div className={styles.modeCost}>{m.cost === 0 ? 'Free' : `LKR ${m.cost.toLocaleString()}`}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation - only for paid bookings */}
            {booking.isPaid ? (
              <div className="card">
                <h3 className={styles.sectionTitle}>Navigation & Ride Booking</h3>
                <div className={styles.actionGrid}>
                  {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-teal">🗺️ Open Full Route in Google Maps</a>}
                  {isPlanBkg    && planForPDF    && <button className="btn btn-gold" onClick={() => exportPlanToPDF(planForPDF, booking)}>📄 Export PDF Itinerary</button>}
                  {isPackage    && packageForPDF && <button className="btn btn-gold" onClick={() => exportPlanToPDF(packageForPDF, booking)}>📄 Export PDF Itinerary</button>}
                  {isCartBkg    && cartForPDF    && <button className="btn btn-gold" onClick={() => exportPlanToPDF(cartForPDF, booking)}>📄 Export PDF Itinerary</button>}
                  {places[0]?.lat && userLoc && (
                    <a href={`https://www.google.com/maps/dir/?api=1&origin=${userLoc.lat},${userLoc.lng}&destination=${places[0].lat},${places[0].lng}&travelmode=driving`}
                      target="_blank" rel="noopener noreferrer" className="btn btn-outline">📍 Directions to First Stop</a>
                  )}
                  <a href="https://pickme.lk" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🛺 Book via PickMe</a>
                  <a href="https://www.uber.com/global/en/cities/colombo" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🚗 Book via Uber</a>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign:'center', padding:'1.5rem', background:'rgba(201,168,76,0.05)', border:'1px solid rgba(201,168,76,0.2)' }}>
                <div style={{ fontSize:'1.75rem', marginBottom:'0.5rem' }}>🔒</div>
                <div style={{ fontFamily:'Cormorant Garamond', fontSize:'1.1rem', color:'var(--gold2)', marginBottom:'0.5rem' }}>Awaiting Payment</div>
                <p style={{ fontSize:'0.82rem', color:'var(--txt3)', marginBottom:'1rem' }}>Complete payment to unlock routes, maps, and navigation.</p>
                <button className="btn btn-gold btn-lg" style={{ width:'100%' }} onClick={handleCompletePayment}>
                  Complete Payment →
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT sidebar ── */}
          <div className={styles.right}>
            <div className="card" style={{ marginBottom:'1rem' }}>
              <h3 className={styles.sectionTitle}>Payment Details</h3>
              {[
                { l:'Amount',         v: `LKR ${booking.totalAmount?.toLocaleString()}` },
                { l:'Payment Status', v: booking.isPaid ? '✓ Paid' : 'Pending' },
                { l:'Booking Ref',    v: booking.bookingRef },
                { l:'Booking Type',   v: booking.bookingType || 'package' },
                { l:'Date Booked',    v: new Date(booking.createdAt || booking.bookingDate).toLocaleDateString('en-GB') },
              ].map(r => (
                <div key={r.l} style={{ display:'flex', justifyContent:'space-between', padding:'0.55rem 0', borderBottom:'1px solid var(--brd)', fontSize:'0.82rem' }}>
                  <span style={{ color:'var(--txt3)' }}>{r.l}</span>
                  <span style={{ color:'var(--txt)', fontWeight:600 }}>{r.v}</span>
                </div>
              ))}
            </div>

            {booking.notes && (
              <div className="card" style={{ marginBottom:'1rem', borderLeft:'2px solid var(--gold)', borderRadius:'0 var(--radius-lg) var(--radius-lg) 0' }}>
                <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gold3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.5rem' }}>Special Requests</div>
                <p style={{ fontSize:'0.85rem', color:'var(--txt2)', lineHeight:'1.6' }}>{booking.notes}</p>
              </div>
            )}

            <div className="card" style={{ background:'var(--gold5)', borderColor:'rgba(201,168,76,0.2)' }}>
              <div style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--gold3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'0.75rem' }}>Travel Tips</div>
              {['Arrive at your first stop 10–15 minutes early.','Carry cash - smaller attractions may not accept cards.','Keep your booking reference handy.','Enable GPS for best navigation accuracy.'].map((tip,i) => (
                <div key={i} style={{ fontSize:'0.8rem', color:'var(--txt2)', padding:'3px 0', display:'flex', gap:'0.5rem' }}>
                  <span style={{ color:'var(--gold)', flexShrink:0 }}>→</span>{tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
