# DayScape - Local Tourist Day-Visit Planner

A full-stack web application for planning optimized day-visit itineraries around Colombo, Sri Lanka. Users can explore attractions, build custom trip plans, book curated packages, and navigate with live maps - all from a single platform.

> **ITE2953 · University of Moratuwa** - K. Mathusha (E2320170)

---

## Table of Contents

- [Overview](#overview)
- [What's New in v2](#whats-new-in-v2)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Database Models](#database-models)
- [API Reference](#api-reference)
- [Authentication & Security](#authentication--security)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Seeding the Database](#seeding-the-database)
- [Demo Credentials](#demo-credentials)
- [Tourist Attractions](#tourist-attractions)
- [Deployment Notes](#deployment-notes)

---

## Overview

DayScape v2 helps both local and international tourists plan optimized day-trips around Colombo. The platform offers:

- A curated library of **11 tourist attractions** with detailed info, photos, pricing, and opening hours
- A **custom day-trip planner** to build, save, edit, and book personalized itineraries
- **Pre-built travel packages** for hassle-free booking
- A **live Leaflet map** with real-time GPS distance calculations
- A complete **payment flow** with credit card validation
- **Google Maps multi-stop navigation** generated post-booking
- **PDF export** of booking itineraries
- A full **admin panel** for managing all platform content and users

---

## Tech Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 14+ | Runtime |
| Express.js | 4.18.2 | HTTP framework |
| MongoDB | - | Database |
| Mongoose | 8.0.3 | ODM |
| JSON Web Token | 9.0.2 | Authentication |
| bcryptjs | 2.4.3 | Password hashing |
| express-validator | 7.0.1 | Input validation |
| Multer | 1.4.5-lts.1 | File uploads |
| dotenv | 16.3.1 | Environment config |
| Nodemon | 3.0.2 | Dev auto-reload |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18.2.0 | UI framework |
| Vite | 5.0.8 | Build tool |
| React Router | 6.21.0 | Client-side routing |
| Axios | 1.6.2 | HTTP client |
| Leaflet + React-Leaflet | 1.9.4 / 4.2.1 | Interactive maps |
| jsPDF | 2.5.1 | PDF export |
| Google Fonts | - | Cormorant Garamond, DM Sans |

---

## Features

### User Features

#### Browsing (Guest & Logged-in)
- Browse all 11 attractions with search, category filter, and sorting (distance, rating, popularity, name)
- View detailed place pages with descriptions, photos, pricing tiers, opening hours, and facilities
- Browse and view curated travel packages
- Interactive live map with GPS-based distance calculation, airport markers, category filters, and full place popups

#### Account & Profile
- Email/password registration and login with JWT session management
- Profile update and password change
- User dashboard with booking history overview

#### Planning
- **Day-Trip Planner** - Search and add attractions, reorder stops, add notes and visit times per stop, view estimated cost and duration
- **Saved Plans** - Save plans, edit them (rename, reorder, add/remove places), and view full plan details
- **Favorites** - Save/unsave places for quick access later

#### Booking & Payment
- Add packages or custom plans to a multi-item shopping cart
- Checkout with full credit card validation:
  - Luhn algorithm for card number structural validity
  - MM/YY expiry format and future-date check
  - 3–4 digit CVV validation
  - Cardholder name required
- Booking confirmation with unique reference number
- View all bookings with full itinerary detail
- **Google Maps navigation** - multi-stop directions URL generated post-payment
- Transport suggestions (car, tuk-tuk, bus, train, walk) based on distance to first stop
- External ride app links (PickMe, Uber)
- Real-time travel distance to first stop using device GPS
- **PDF export** of the complete booking itinerary

#### Reviews
- Submit star ratings (1–5) and written reviews for attractions
- Read approved reviews from other users

### Admin Features

| Area | Capabilities |
|---|---|
| Dashboard | Platform analytics and statistics |
| Places | Create, edit, soft-delete tourist attractions |
| Categories | Create/edit categories with emoji icons and colors |
| Packages | Create/edit curated travel packages |
| Reviews | Approve or reject user-submitted reviews |
| Users | View all users, suspend/activate accounts |
| Bookings | View all platform bookings with payment status |
| Revenue | Payment history and transaction tracking |

---

## Project Structure

```
dayscape-v2/
├── backend/
│   ├── config/
│   │   └── db.js                    # MongoDB connection
│   ├── middleware/
│   │   └── auth.js                  # JWT middleware (protect, adminProtect)
│   ├── models/
│   │   ├── User.js                  # User accounts
│   │   ├── Admin.js                 # Admin accounts
│   │   ├── Place.js                 # Tourist attractions
│   │   ├── Category.js              # Place categories
│   │   ├── VisitPlan.js             # Custom day-trip plans
│   │   ├── Package.js               # Curated tour packages
│   │   ├── Booking.js               # Bookings (package/plan/cart)
│   │   ├── Payment.js               # Payment records
│   │   ├── Review.js                # Place reviews
│   │   ├── Favorite.js              # Saved places
│   │   └── Cart.js                  # Shopping carts
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── adminAuthController.js
│   │   ├── placeController.js
│   │   ├── categoryController.js
│   │   ├── packageController.js
│   │   ├── bookingController.js     # Also handles payment logic
│   │   ├── planController.js
│   │   ├── reviewController.js
│   │   ├── favoriteController.js
│   │   ├── cartController.js
│   │   ├── adminController.js
│   │   └── mapController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── adminAuthRoutes.js
│   │   ├── placeRoutes.js
│   │   ├── categoryRoutes.js
│   │   ├── packageRoutes.js
│   │   ├── bookingRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── planRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── favoriteRoutes.js
│   │   ├── cartRoutes.js
│   │   ├── userRoutes.js
│   │   ├── adminRoutes.js
│   │   └── mapRoutes.js
│   ├── seed/
│   │   └── seedData.js              # Demo data: 9 categories, 11 places, 2 users, 1 admin, 4 reviews, 6 packages
│   ├── server.js                    # Express entry point
│   ├── package.json
│   └── .env
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── common/
    │   │   │   ├── Navbar.jsx
    │   │   │   └── Footer.jsx
    │   │   └── place/
    │   │       └── PlaceCard.jsx
    │   ├── context/
    │   │   ├── AuthContext.jsx       # User + admin session state
    │   │   ├── CartContext.jsx       # Shopping cart global state
    │   │   └── ToastContext.jsx      # Global toast notifications
    │   ├── hooks/
    │   │   └── useLocation.js        # GPS position + Haversine distance
    │   ├── layouts/
    │   │   └── AdminLayout.jsx
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── AboutPage.jsx
    │   │   ├── ExplorePage.jsx       # Searchable/filterable attraction browser
    │   │   ├── PlaceDetailPage.jsx
    │   │   ├── LiveMapPage.jsx
    │   │   ├── PackagesPage.jsx
    │   │   ├── PackageDetailPage.jsx
    │   │   ├── NotFoundPage.jsx
    │   │   ├── auth/
    │   │   │   ├── LoginPage.jsx
    │   │   │   ├── RegisterPage.jsx
    │   │   │   └── AdminLoginPage.jsx
    │   │   ├── user/
    │   │   │   ├── UserDashboard.jsx
    │   │   │   ├── UserProfile.jsx
    │   │   │   ├── FavoritesPage.jsx
    │   │   │   ├── PlannerPage.jsx   # Create new trip plan
    │   │   │   ├── SavedPlansPage.jsx
    │   │   │   ├── EditPlanPage.jsx
    │   │   │   ├── PlanDetailPage.jsx
    │   │   │   ├── CartPage.jsx
    │   │   │   ├── PaymentPage.jsx
    │   │   │   ├── BookingSuccessPage.jsx
    │   │   │   ├── BookingsPage.jsx
    │   │   │   └── BookingDetailPage.jsx
    │   │   └── admin/
    │   │       ├── AdminDashboard.jsx
    │   │       ├── AdminPlaces.jsx
    │   │       ├── AdminCategories.jsx
    │   │       ├── AdminPackages.jsx
    │   │       ├── AdminUsers.jsx
    │   │       ├── AdminReviews.jsx
    │   │       └── AdminBookings.jsx
    │   ├── services/
    │   │   └── api.js                # Axios instance with auth interceptors
    │   ├── utils/
    │   │   └── pdfExport.js          # jsPDF booking itinerary generator
    │   ├── App.jsx                   # Route config + context providers
    │   ├── main.jsx                  # React entry point
    │   └── index.css
    ├── vite.config.js                # Vite config + /api proxy to backend
    ├── index.html
    └── package.json
```

---

## Database Models

### User
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique, required |
| password | String | bcrypt hashed |
| phone | String | optional |
| nationality | String | optional |
| role | String | `'user'` (default) |
| isActive | Boolean | suspension flag |
| savedPlans | [ObjectId] | ref: VisitPlan |
| favorites | [ObjectId] | ref: Favorite |

### Admin
| Field | Type | Notes |
|---|---|---|
| name | String | required |
| email | String | unique |
| password | String | bcrypt hashed |
| role | String | `'admin'` |
| isActive | Boolean | - |

### Place
| Field | Type | Notes |
|---|---|---|
| name / slug | String | slug auto-generated from name |
| category | ObjectId | ref: Category |
| description / shortDescription | String | - |
| coordinates | `{ lat, lng }` | GPS verified |
| distances | `{ fromAirport, fromCity }` | km |
| timing | `{ open, close, days }` | opening hours |
| tickets | `{ local, foreign, child, student }` | 4 price tiers |
| rating / reviewCount | Number | aggregated at write time |
| tags | [String] | search tags |
| isActive / isFeatured | Boolean | soft-delete + homepage feature |

### VisitPlan
| Field | Type | Notes |
|---|---|---|
| user | ObjectId | ref: User |
| name / description | String | - |
| planDate | Date | - |
| places | `[{ place, order, visitTime, notes, duration }]` | ordered stops |
| estimatedTotalCost | Number | - |
| estimatedDuration | Number | minutes |
| totalDistance | Number | km |
| status | String | `draft` / `saved` / `booked` |
| googleMapsUrl | String | generated post-payment |

### Booking
| Field | Type | Notes |
|---|---|---|
| user | ObjectId | ref: User |
| bookingType | String | `'package'` / `'plan'` / `'cart'` |
| package / plan | ObjectId | conditional ref |
| cartItems | `[{ itemType, ref, price }]` | for cart checkouts |
| visitDate | Date | - |
| adults / children | Number | guest count |
| totalAmount | Number | - |
| isPaid / status | Boolean / String | payment state |
| bookingRef | String | unique confirmation code |

### Payment
| Field | Type | Notes |
|---|---|---|
| bookingId | ObjectId | ref: Booking |
| amount | Number | - |
| method | String | `'credit_card'` etc. |
| status | String | `'success'` / `'failed'` |
| transactionId | String | unique |

### Cart
| Field | Type | Notes |
|---|---|---|
| user | ObjectId | ref: User |
| items | `[{ itemType, package/plan, quantity, adults, children, visitDate, price }]` | - |
| total | Virtual | computed sum of all item prices |

### Review
| Field | Type | Notes |
|---|---|---|
| user | ObjectId | ref: User |
| place | ObjectId | ref: Place |
| rating | Number | 1–5 |
| title / comment | String | - |
| visitDate | Date | - |
| isApproved | Boolean | admin must approve before showing |

---

## API Reference

All endpoints are prefixed with `/api` and return JSON.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | - | Register new user |
| POST | `/api/auth/login` | - | User login, returns JWT |
| GET | `/api/auth/me` | User | Get current user profile |
| PUT | `/api/auth/profile` | User | Update profile |
| PUT | `/api/auth/password` | User | Change password |
| POST | `/api/admin/auth/login` | - | Admin login, returns JWT |
| GET | `/api/admin/auth/me` | Admin | Get current admin |

### Places

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/places` | - | Browse places (`?category`, `?search`, `?sort`, `?lat`, `?lng`, `?entryType`) |
| GET | `/api/places/featured` | - | Featured places (max 6) |
| GET | `/api/places/:slug` | - | Place detail with reviews |
| GET | `/api/places/admin/all` | Admin | All places including inactive |
| POST | `/api/places` | Admin | Create place |
| PUT | `/api/places/:id` | Admin | Update place |
| DELETE | `/api/places/:id` | Admin | Soft-delete place |

### Categories

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/categories` | - | List all categories |
| POST | `/api/categories` | Admin | Create category |
| PUT | `/api/categories/:id` | Admin | Update category |
| DELETE | `/api/categories/:id` | Admin | Delete category |

### Packages

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/packages` | - | Browse packages |
| GET | `/api/packages/:id` | - | Package detail |
| POST | `/api/packages` | Admin | Create package |
| PUT | `/api/packages/:id` | Admin | Update package |
| DELETE | `/api/packages/:id` | Admin | Delete package |

### Day-Trip Plans

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/plans` | User | Create new plan |
| GET | `/api/plans` | User | Get user's plans |
| GET | `/api/plans/:id` | User | Get plan detail |
| PUT | `/api/plans/:id` | User | Update plan |
| DELETE | `/api/plans/:id` | User | Delete plan |

### Bookings

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/bookings` | User | Create booking |
| GET | `/api/bookings` | User | User's bookings |
| GET | `/api/bookings/:id` | User | Booking detail |
| GET | `/api/bookings/admin/all` | Admin | All platform bookings |

### Payments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/payments/process` | User | Process card payment |
| GET | `/api/payments/my` | User | User's payment history |
| GET | `/api/payments/admin/all` | Admin | All payments |

### Cart

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/cart` | User | Get cart |
| POST | `/api/cart` | User | Add item |
| PUT | `/api/cart/:itemId` | User | Update item |
| DELETE | `/api/cart/:itemId` | User | Remove item |
| DELETE | `/api/cart` | User | Clear cart |

### Reviews

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/reviews` | User | Submit review |
| GET | `/api/reviews/:placeId` | - | Get place reviews |
| DELETE | `/api/reviews/:id` | User | Delete own review |
| PUT | `/api/reviews/:id/approve` | Admin | Approve review |

### Favorites

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/favorites/:placeId` | User | Add to favorites |
| DELETE | `/api/favorites/:placeId` | User | Remove from favorites |
| GET | `/api/favorites` | User | User's favorites |
| GET | `/api/favorites/:placeId/check` | User | Check if favorited |

### Users & Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/users` | User | Get current user |
| GET | `/api/users/admin/all` | Admin | All users |
| GET | `/api/admin/dashboard` | Admin | Dashboard statistics |
| PUT | `/api/admin/users/:id` | Admin | Suspend/activate user |

### Map

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/map/nearby` | - | Nearby services/facilities |
| GET | `/api/map/route-info` | - | Route and transport info |

---

## Authentication & Security

### Session Management
- JWTs stored in `localStorage` under keys `token` and `role`
- All requests automatically attach the token via an Axios request interceptor
- 401 responses automatically log the user out and redirect to login
- Token expiry is configurable via `JWT_EXPIRE` (default: `7d`)

### Password Security
- Passwords hashed with bcryptjs (10 salt rounds) via a Mongoose `pre-save` hook
- Raw passwords are never returned in any API response
- Timing-safe comparison via `bcrypt.compare`

### Payment Validation
- **Luhn algorithm** - structural validity of card number
- **Expiry check** - MM/YY format, must be a future date
- **CVV check** - 3–4 digits required
- **Cardholder name** - required, non-empty

> Note: No live payment processor is integrated. Payment is simulated and ready to be replaced with Stripe or PayPal.

### Authorization Middleware

| Middleware | Applied to |
|---|---|
| `protect` | All user-only routes |
| `adminProtect` | All admin-only routes |

Both validate the JWT, confirm the subject exists and is active, and attach the decoded identity to `req.user` / `req.admin`.

---

## Getting Started

### Prerequisites

- **Node.js** v14 or higher
- **npm** v6 or higher
- **MongoDB** - local instance or [MongoDB Atlas](https://www.mongodb.com/atlas)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env - set MONGO_URI to your MongoDB connection string
```

Seed the database:

```bash
npm run seed
```

Start the development server:

```bash
npm run dev
# Backend runs on http://localhost:5000
```

### 2. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:5173
```

The Vite dev server proxies all `/api` requests to `http://localhost:5000`, so no CORS configuration is needed in development.

### 3. Open the App

Navigate to **http://localhost:5173** in your browser.

### Production Build

```bash
# Build frontend static files
cd frontend
npm run build
# Output in frontend/dist/ - serve via nginx or any static host

# Run backend in production
cd backend
# Set NODE_ENV=production in .env
npm start
```

---

## Environment Variables

Create `backend/.env` (copy from `.env.example`):

```env
# Server
PORT=5000

# Database
MONGO_URI=mongodb://localhost:27017/dayscape

# Authentication
JWT_SECRET=your_strong_random_secret_here
JWT_EXPIRE=7d

# Environment
NODE_ENV=development
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Express server port |
| `MONGO_URI` | **Yes** | - | MongoDB connection string |
| `JWT_SECRET` | **Yes** | - | JWT signing key - use a long random string in production |
| `JWT_EXPIRE` | No | `7d` | JWT expiry duration |
| `NODE_ENV` | No | `development` | `development` or `production` |

---

## Seeding the Database

The seed script populates the database with demo data:

| Data | Count |
|---|---|
| Categories | 9 |
| Tourist Attractions | 11 |
| Sample Users | 2 |
| Admin Account | 1 |
| Sample Reviews | 4 |
| Curated Packages | 6 |

```bash
cd backend
npm run seed
```

The script clears all existing data before inserting, so it is safe to run multiple times to reset to a clean state.

---

## Demo Credentials

### Admin

| Field | Value |
|---|---|
| Email | `admin@dayscape.lk` |
| Password | `Admin@123` |

### Sample Users

| Email | Password |
|---|---|
| `mathusha@example.com` | `User@123` |
| `james@example.com` | `User@123` |

---

## Tourist Attractions

All 11 attractions are seeded with GPS-verified coordinates and Haversine-calculated distances from the reference location:

**Reference:** 38 Rajasinghe Road, Dehiwala, Colombo - Lat: 6.868671, Lng: 79.860689

| # | Attraction | Distance |
|---|---|---|
| 1 | Viharamahadevi Park | 6.7 km |
| 2 | Gangaramaya Temple | 6.6 km |
| 3 | One Galle Face Green | 6.9 km |
| 4 | Colombo Port City | 8.9 km |
| 5 | Dehiwala Zoological Gardens | 2.6 km (nearest) |
| 6 | Cinnamon Life at City of Dreams | 6.8 km |
| 7 | National Museum Colombo | 6.7 km |
| 8 | Beddagana Wetland Park | 8.2 km |
| 9 | Kelaniya Water World Lanka | 19 km |
| 10 | Colombo Lotus Tower | 8.6 km |
| 11 | Sri Lanka Planetarium | 4.8 km |

**Airport reference:** Bandaranaike International Airport (BIA), Katunayake - used for distance calculations for arriving international tourists.

**Data accuracy notes:**
- Coordinates: GPS verified
- Distances: Haversine formula from reference point
- Opening times: Based on publicly available information
- Ticket prices: Realistic sample values - verify and update in the admin dashboard
- Phone numbers marked `[SAMPLE]` are placeholder values

---

## Deployment Notes

### Deployment Checklist

- [ ] Set `NODE_ENV=production` in `backend/.env`
- [ ] Replace `JWT_SECRET` with a strong random value (e.g., `openssl rand -base64 64`)
- [ ] Update CORS in `backend/server.js` to allow only your production domain
- [ ] Use MongoDB Atlas or a managed MongoDB host
- [ ] Run the backend with a process manager (PM2 or systemd)
- [ ] Configure nginx to:
  - Serve `frontend/dist/` as static files
  - Proxy `/api/*` to `http://localhost:5000`
- [ ] Enable HTTPS (Let's Encrypt / Certbot)
- [ ] Integrate a real payment processor (Stripe, PayPal) to replace the simulation

### Notes

- No Docker configuration is included. Use a standard Node.js + MongoDB Docker setup for containerized deployment.
- The Vite proxy (`/api` → `localhost:5000`) is development-only. In production, configure the reverse proxy at the web server level.

---

## Key Architecture Decisions

| Decision | Rationale |
|---|---|
| Soft delete (`isActive` flag) | Preserves booking and review history when places or users are removed |
| Review aggregation at write time | `rating` and `reviewCount` stored on the Place document for fast reads without aggregation overhead |
| Google Maps URL generated post-payment | Prevents navigation access without a confirmed booking |
| Haversine distance computed client-side | Enables live real-time distance updates as the user's GPS position changes |
| Dual auth models (User + Admin) | Separate Mongoose models and JWT flows ensure admin routes cannot be accessed with a user token |
| Cart supports heterogeneous items | A single cart can hold both packages and custom plans; the checkout creates one booking per item |

---

*DayScape - Colombo, Sri Lanka Tourist Planner · ITE2953 · University of Moratuwa*
