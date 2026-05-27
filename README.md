# Delivery Rider Portal

A web-based module for riders to log in, view assigned deliveries, update delivery status, confirm completed deliveries, and review delivery history.

## Main Integrations

- **Authentication System** - handles rider login and role-based access.
- **Order Management System** - sends assigned orders/shipments to the rider portal.
- **Customer Tracking Portal** - can read delivery status using a tracking number.
- **Notification System** - can receive or fetch rider delivery alerts.
- **Delivery Performance Monitoring System** - can get rider delivery summaries.
- **Analytics Dashboard System** - can get delivery summary data.
- **Return Management System** - can send failed/returned delivery records.

## Tech Stack

React.js, Node.js, Express.js, MySQL, JWT

## How to Run

1. Start XAMPP MySQL and import `database/youngstunna_rider_portal.sql`.
2. Run the Authentication System on `http://localhost:3000`.
3. Create `backend/.env` from `backend/.env.example`.
4. Run the backend:

```bash
cd backend
npm install
npm start
```

5. Run the frontend:

```bash
cd frontend
npm install
npm run dev
```

## Backend URL

```text
http://localhost:3600
```

## Main Endpoint List

```text
GET  /api/delivery-rider/endpoints
POST /api/delivery-rider/shipments
GET  /api/delivery-rider/tracking/:trackingNumber
GET  /api/delivery-rider/notifications/:riderId
POST /api/delivery-rider/notifications
GET  /api/delivery-rider/performance/:riderId
GET  /api/delivery-rider/analytics/summary
POST /api/delivery-rider/returns
```

For request bodies and setup details, see `INTEGRATION_ENDPOINTS.md`.
