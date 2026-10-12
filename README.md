# DroneFood

A full-stack food-delivery platform that supports multi-restaurant ordering, merchant and branch management, drone and shipper deliveries, online payments, and real-time order updates.

> This is a personal portfolio project. It is not represented as a production-ready delivery platform.

## Live demos

| Surface | URL |
| --- | --- |
| Customer web | [dronefood.vercel.app](https://dronefood.vercel.app/) |
| Restaurant web | [restaurant-dronefood.vercel.app](https://restaurant-dronefood.vercel.app/) |
| Admin web | [admin-dronefood.vercel.app](https://admin-dronefood.vercel.app/) |

## Highlights

- **Multi-restaurant carts:** customers can keep independent carts per restaurant and check out each cart separately.
- **Multi-branch merchants:** a merchant can manage one or more branches, shared menus, managers, operating hours, delivery coverage, and drone-delivery availability.
- **Two delivery modes:** supports drone delivery and manual shipper delivery, including location updates for active shipper deliveries.
- **Real-time flows:** Socket.IO sends order, delivery, and notification updates to role-scoped rooms.
- **Delivery verification:** customers use QR codes to open a drone cargo bay and confirm delivery.
- **Payments and finance:** supports cash on delivery and PayOS checkout, with wallet, withdrawal, refund, and payout workflows.
- **Authorization and auditability:** JWT authentication, role-based access control, ownership checks, rate limiting, validation, and append-only audit logs for privileged actions.

## Architecture

DroneFood is a monorepo with independently runnable API and web applications, Expo mobile applications, and shared packages.

```text
apps/
├── api/                 Express REST API and Socket.IO server
├── customer-web/        Customer-facing React application
├── admin-web/           Administration dashboard
├── restaurant-web/      Merchant and branch management application
├── customer-mobile/     Expo customer application
├── restaurant-mobile/   Expo restaurant application
└── shipper-mobile/      Expo shipper application
packages/
├── web-ui/              Shared web components and design tokens
├── contracts/           Shared TypeScript API and domain contracts
└── api-client/          Shared typed API helpers
```

The API uses a layered `Controller → Service → Repository` design:

- **Controllers** translate HTTP requests and responses.
- **Services** implement business rules, authorization, and orchestration.
- **Repositories** isolate Mongoose database access.

## Tech stack

| Area | Technologies |
| --- | --- |
| Backend | Node.js, Express, MongoDB, Mongoose, JWT, Joi, Socket.IO, Pino |
| Payments and integrations | PayOS, Cloudinary, Nodemailer, TrackAsia |
| Web | React 18, Vite, React Router, Axios, Leaflet, TrackAsia GL |
| Mobile | Expo, React Native, TypeScript, TanStack Query |
| Shared code | npm workspaces, shared contracts, API client, and web UI package |
| Quality | Vitest, Supertest, mongodb-memory-server, Node test runner, ESLint |
| Infrastructure | Docker, Docker Compose, Nginx, Vercel, Render |

## Local development

### Prerequisites

- Node.js `>=22.13.0`
- MongoDB instance, local or hosted
- Cloudinary credentials for uploads
- PayOS credentials for payment flows

### Install dependencies

```bash
git clone https://github.com/2imTBM2k4/DroneFood.git
cd DroneFood

npm install
npm install --prefix apps/api
npm install --prefix apps/customer-web
npm install --prefix apps/admin-web
npm install --prefix apps/restaurant-web
```

Create `apps/api/.env` from [`apps/api/.env.example`](apps/api/.env.example), then add the environment values needed for your local services. Create `.env` files for the web apps with at least:

```env
VITE_API_URL=http://localhost:4000
```

### Start applications

```bash
# API: http://localhost:4000
npm run dev --prefix apps/api

# Customer web
npm run dev --prefix apps/customer-web

# Admin web
npm run dev --prefix apps/admin-web

# Restaurant web
npm run dev --prefix apps/restaurant-web
```

The Expo applications are defined as root npm workspaces. Run their available scripts by workspace, for example:

```bash
npm run typecheck --workspace=@drone-food/customer-mobile
npm run typecheck --workspace=@drone-food/restaurant-mobile
npm run typecheck --workspace=@drone-food/shipper-mobile
```

### Docker

```bash
docker compose up -d --build
```

## Verification

Run the checks relevant to the surface you change:

```bash
# API
npm run lint --prefix apps/api
npm test --prefix apps/api

# Customer web
npm test --prefix apps/customer-web
npm run lint --prefix apps/customer-web
npm run build --prefix apps/customer-web

# Admin web
npm test --prefix apps/admin-web
npm run lint --prefix apps/admin-web
npm run build --prefix apps/admin-web

# Restaurant web
npm run lint --prefix apps/restaurant-web
npm run build --prefix apps/restaurant-web

# Shared mobile packages and applications
npm run mobile:typecheck
```

## Documentation

- [Vietnamese system architecture](docs/ARCHITECTURE.vi.md)
- [English system architecture](docs/ARCHITECTURE.en.md)
- [Render cron-job setup](docs/RENDER_CRON.vi.md)

## License

This repository is published for portfolio and educational purposes.
