# Drone Food — Food Delivery Platform with Drone Support

A full-stack food delivery web application with drone-based delivery, built with Express.js, React, and MongoDB.

## 🌐 Live Demo

| App | URL |
|-----|-----|
| 🛒 Customer | [dronefood.vercel.app](https://dronefood.vercel.app/) |
| 🍽️ Restaurant | [restaurant-dronefood.vercel.app](https://restaurant-dronefood.vercel.app/) |
| ⚙️ Admin | [admin-dronefood.vercel.app](https://admin-dronefood.vercel.app/) |

## Documentation

Full system architecture (27 sections, with diagrams):

- 🇻🇳 [`docs/ARCHITECTURE.vi.md`](docs/ARCHITECTURE.vi.md) — Tiếng Việt
- 🇬🇧 [`docs/ARCHITECTURE.en.md`](docs/ARCHITECTURE.en.md) — English

## Architecture

```
├── backend/          Express.js REST API (Node.js, ES Modules)
├── user/             React app — Customer-facing
├── admin/            React app — Admin dashboard
├── restaurant/       React app — Restaurant owner panel
└── shared/           Design tokens + shared components
```

### Backend Architecture

The backend follows a layered **Controller → Service → Repository** pattern:

- **Controllers** handle HTTP request/response
- **Services** contain business logic
- **Repositories** wrap Mongoose queries

```
backend/
├── server.js              # Entry point (HTTP server, Socket.io, Cloudinary)
├── app.js                 # Express app (routes, middleware) — separated for testing
├── config/                # DB connection, Cloudinary, Multer, fees
├── controllers/           # HTTP handlers
├── services/              # Business logic
├── repositories/          # Database queries
├── models/                # Mongoose schemas (.cjs)
├── middleware/             # JWT auth (protect, optionalAuth, authorize), validation
├── routes/                # Route definitions
├── validations/           # Joi schemas for input validation
├── utils/                 # AppError, auditLog, geocode, sendEmail, foodOptions
├── seeds/                 # Database seed scripts
└── tests/                 # Vitest test suite
    ├── setup.js           # MongoDB in-memory server
    ├── helpers.js          # Test utilities (create users, tokens, etc.)
    ├── unit/              # Unit tests (services, middleware)
    ├── integration/       # API endpoint tests
    └── flows/             # End-to-end business flow tests
```

## Tech Stack

### Backend
- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT (30-minute access token + 7-day refresh token)
- **Validation**: Joi (with `stripUnknown` for mass-assignment protection)
- **Real-time**: Socket.io (order notifications to restaurants)
- **Payments**: Stripe, PayPal
- **Image hosting**: Cloudinary
- **File upload**: Multer (JPEG/PNG/GIF/WebP, 5MB limit)
- **Email**: Nodemailer (password reset)
- **Geocoding**: TrackAsia API
- **Security**: CORS whitelist, express-rate-limit, bcrypt password hashing
- **HTTP logging**: Morgan
- **Testing**: Vitest, Supertest, mongodb-memory-server

### Frontend (all three apps)
- **Framework**: React 18
- **Build tool**: Vite
- **Routing**: React Router v6
- **HTTP**: Axios
- **Notifications**: React Toastify
- **Icons**: Lucide React
- **Maps**: Leaflet / React-Leaflet + TrackAsia GL
- **QR**: qrcode.react + html5-qrcode
- **Payments**: @paypal/react-paypal-js (user app)
- **Charts**: Chart.js + Recharts (admin app)

### Infrastructure
- **Docker + Docker Compose** — 4 services (backend, user, admin, restaurant)
- **Nginx** — serves static frontend builds in containers

## Features

### Customer (user/)
- Browse restaurants (radius-based, sorted by distance)
- Pick exact delivery location on map (Geolocation + TrackAsia)
- View restaurant menu with food option groups (sizes, toppings)
- Add to cart (single-restaurant restriction) with item customization
- Place orders (COD, Card via Stripe, PayPal)
- Track drone delivery in real-time
- Scan QR code to open drone cargo bay and confirm receipt
- Cancel pending orders with reason
- View order history with status tracking
- User profile management (name, phone, avatar)
- Change password
- Reset password via email

### Restaurant Owner (restaurant/)
- Register restaurant (requires admin approval, with geocoding)
- Manage food menu (add, edit, remove with images)
- Configure food option groups (sizes, toppings with price deltas)
- Receive real-time order notifications via Socket.io
- Accept orders (pending → preparing → delivering)
- Cancel orders with reason
- Open/close restaurant for trade
- Edit restaurant details
- View order history and dashboard

### Admin (admin/)
- Dashboard with statistics (users, orders, revenue)
- Manage users (lock/unlock accounts, edit, delete)
- Approve/reject restaurants (lock/unlock)
- Manage drone fleet (create, edit, delete, reassign)
- View delivery history
- Update cargo weight
- View all orders across restaurants
- Audit trail viewer (who did what, when, and why)

### Drone Food Delivery System
- Auto-assign available drone when order starts delivering (battery ≥ 30%)
- Drone selection: least-used first
- QR code generated for delivery verification (SHA-256)
- Cargo bay lid control (auto-open for 5 seconds on QR scan)
- Cargo weight tracking
- Drone status management (available, delivering, delivered)
- Drone reassignment by admin
- Delivery history logging

## Order Status Flow

```
pending → preparing → delivering → delivered
   ↓          ↓
cancelled  cancelled
(by user)  (by restaurant, requires reason)
```

- **User** can cancel only when `pending` (reason required)
- **Restaurant** can cancel at `pending` or `preparing` (reason required)
- **Admin** can update any status (reason required)
- **COD** orders are auto-marked as paid when delivered
- **Revenue** is split 80% restaurant / 20% platform on `itemsPrice` (delivery fees go entirely to platform)

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Cloudinary account
- Stripe account (for card payments)
- PayPal developer account (for PayPal payments)

### 1. Clone the repository

```bash
git clone https://github.com/2imTBM2k4/DroneFood.git
cd DroneFood
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create `backend/.env` (see `.env.example`):

```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/drone_delivery
JWT_SECRET=your-secret-key

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

STRIPE_SECRET_KEY=sk_test_...
PAYPAL_CLIENT_ID=your-paypal-client-id

FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175

# Optional
TRACKASIA_KEY=public_key
NODE_ENV=development

# For password reset emails (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-app-password
```

Seed the database (optional):

```bash
node seeds/seedData.cjs     # Users + restaurants + food items
npm run seed:drones          # Drone fleet
```

Start the backend:

```bash
npm run dev
```

### 3. Setup Frontend Apps

Each frontend app needs a `.env` file:

```env
VITE_API_URL=http://localhost:4000
```

The user app also supports:
```env
VITE_TRACKASIA_KEY=public_key
```

Then install and run:

```bash
# Customer app (port 5173)
cd user && npm install && npm run dev

# Admin dashboard (port 5174)
cd admin && npm install && npm run dev

# Restaurant panel (port 5175)
cd restaurant && npm install && npm run dev
```

### 4. Docker (alternative)

```bash
docker compose up -d --build
```

This starts all 4 services (backend on :4000, user on :5173, admin on :5174, restaurant on :5175).

## Testing

The backend has **106 automated tests** covering unit, integration, and end-to-end business flows.

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage
```

### Test Structure

| Type | Tests | What it covers |
|------|-------|----------------|
| Unit | 53 | Services (user, cart), auth middleware |
| Integration | 40 | API endpoints (auth, cart, order) |
| Flow | 13 | Full business scenarios (order lifecycle, auth, cart rules) |

### Example Flow Tests

- User places COD order → restaurant confirms → delivers → balance splits 80/20 on `itemsPrice`
- User cancels pending order → order cancelled, no balance change
- User cannot cancel preparing/delivering order
- User A cannot access User B's orders
- Cart rejects items from different restaurants
- Drone assigned with battery ≥ 30%; no drone → 409, order stays in preparing

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/user/register` | - | Register user (rate-limited) |
| POST | `/api/user/login` | - | Login (rate-limited) |
| POST | `/api/user/logout` | - | Logout |
| POST | `/api/user/forgot-password` | - | Send password reset email (rate-limited) |
| POST | `/api/user/reset-password` | - | Reset password with token (rate-limited) |
| POST | `/api/user/refresh-token` | - | Refresh access token (rate-limited) |

### User Profile
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/me` | Required | Get profile |
| PUT | `/api/user/update-address` | Required | Update delivery address |
| PUT | `/api/user/profile` | Required | Update profile (name, phone) |
| PUT | `/api/user/change-password` | Required | Change password |
| PUT | `/api/user/avatar` | Required | Upload avatar |

### User Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/list` | Admin | List all users |
| GET | `/api/user/stats` | Admin | User statistics |
| POST | `/api/user/lock` | Admin | Lock/unlock user |
| PUT | `/api/user/update-by-admin` | Admin | Update user by admin |
| DELETE | `/api/user/delete` | Admin | Delete user |

### Food
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/food/list` | Optional | List food items |
| GET | `/api/food/:id` | - | Get food by ID |
| POST | `/api/food/add` | Required | Add food (restaurant owner) |
| POST | `/api/food/update` | Required | Update food |
| POST | `/api/food/remove` | Required | Remove food |

### Cart
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cart/get` | Required | Get cart |
| POST | `/api/cart/add` | Required | Add item |
| POST | `/api/cart/update-line` | Required | Set quantity for a line (0 = remove) |
| POST | `/api/cart/remove-line` | Required | Remove a line |
| POST | `/api/cart/clear` | Required | Clear cart |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/order/place` | Required | Place order |
| POST | `/api/order/verify` | Required | Verify payment |
| GET | `/api/order/userorders` | Required | User's orders |
| GET | `/api/order/list` | Required | List orders (admin/restaurant) |
| POST | `/api/order/status` | Required | Update order status |
| GET | `/api/order/status-stats` | Admin | Order statistics |

### Restaurant
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/restaurant/list` | Optional | List restaurants |
| GET | `/api/restaurant/:id` | Required | Get restaurant |
| POST | `/api/restaurant/` | Required | Create restaurant |
| PUT | `/api/restaurant/:id` | Required | Update restaurant (owner/admin) |
| DELETE | `/api/restaurant/` | Admin | Delete restaurant |
| PATCH | `/api/restaurant/:id/open-state` | Owner/Admin | Open/close for trade |
| PUT | `/api/restaurant/:id/lock` | Admin | Lock/unlock restaurant |

### Drone
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/drone/` | Admin | List drones |
| GET | `/api/drone/:id` | Admin | Get drone |
| POST | `/api/drone/create` | Admin | Create drone |
| PUT | `/api/drone/:id` | Admin | Update drone |
| DELETE | `/api/drone/:id` | Admin | Delete drone |
| POST | `/api/drone/assign` | Admin/Owner | Assign drone to order |
| POST | `/api/drone/reassign` | Admin | Reassign drone |
| POST | `/api/drone/scan-qr` | Required | Scan QR code |
| POST | `/api/drone/confirm-delivery` | Required | Confirm delivery |
| POST | `/api/drone/cargo-weight` | Admin | Update cargo weight |
| GET | `/api/drone/addresses/:orderId` | Required | Get delivery addresses |
| GET | `/api/drone/history/all` | Admin | All delivery history |
| GET | `/api/drone/history/:id` | Admin | Drone delivery history |

### Config
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/config/fees` | - | Get delivery/service fees |
| GET | `/api/config/paypal` | - | Get PayPal client ID |

### Audit
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/audit/` | Admin | List audit logs |

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | - | Health check (DB status, uptime) |

## Default Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dronedelivery.com | admin123 |
| User | john@example.com | user123 |
