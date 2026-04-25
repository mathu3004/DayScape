# DayScape v2 - Local Tourist Day-Visit Planner
### ITE2953 · University of Moratuwa · K. Mathusha (E2320170)

## What's New in v2
- Guest mode: browse places, map, packages WITHOUT login
- No alert() popups - clean redirect-to-login UX
- Editable saved plans (rename, reorder, add/remove places)
- Cart system (add packages + custom plans, checkout)
- Full payment validation (Luhn, expiry, CVV, name checks)
- Booking detail page with Google Maps multi-stop route
- Transport suggestions (car, tuk-tuk, bus, train, walk)
- External ride app buttons (PickMe, Uber)
- Airport (BIA) marker on live map with distance
- Reference location (38 Rajasinghe Rd) correctly marked
- Full place popup on map (image, details, auth-aware buttons)
- Category filter on map
- Accurate seed data for all 11 places

## Reference Location
38 Rajasinghe Road, Dehiwala, Colombo
Lat: 6.868671 · Lng: 79.860689

## Quick Start

cd dayscape-v2/backend && npm install
cd ../frontend && npm install
cd ../backend && cp .env.example .env  # edit MONGO_URI if needed
npm run seed
npm run dev  # backend on :5000

# new terminal
cd ../frontend && npm run dev  # frontend on :5173

## Credentials
Admin: admin@dayscape.lk / Admin@123
User 1: mathusha@example.com / User@123
User 2: james@example.com / User@123

## The 11 Places (Official Dataset)
1. Viharamahadevi Park     - 6.7 km
2. Gangaramaya Temple      - 6.6 km
3. One Galle Face Green    - 6.9 km
4. Colombo Port City       - 8.9 km
5. Dehiwala Zoological Gardens - 2.6 km
6. Cinnamon Life at City of Dreams - 6.8 km
7. National Museum Colombo - 6.7 km
8. Beddagana Wetland Park  - 8.2 km
9. Kelaniya Water World Lanka - 19 km
10. Colombo Lotus Tower   - 8.6 km
11. Sri Lanka Planetarium - 4.8 km

## Data Accuracy Notes
- Coordinates: verified GPS
- Distances: Haversine formula from reference point
- Opening times: based on publicly available information
- Ticket prices: [SAMPLE] realistic values - verify in admin dashboard
- Phone numbers marked [SAMPLE] are placeholder values
