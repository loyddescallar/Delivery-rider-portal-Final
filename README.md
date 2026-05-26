# Delivery Rider Portal

The Delivery Rider Portal is a web-based rider module for managing assigned deliveries. Riders can log in, view delivery tasks, update delivery status, confirm completed deliveries, and review delivery history.

## System Integration

This project is integrated with the **Authentication System** for rider login and role-based access. It is also connected on the Delivery Rider Portal side with the **Order Management System** through a shipment adapter endpoint.

## Main Features

- Rider login authentication
- Rider dashboard
- View assigned deliveries
- Update delivery status
- Confirm completed deliveries
- View delivery history
- Order Management shipment adapter
- Prepared endpoints for tracking, notification, performance, and analytics modules

## Technologies Used

- React.js
- Node.js
- Express.js
- MySQL
- JWT Authentication

## Project Structure

```text
Delivery-Rider-Portal-Final
├── backend
├── frontend
├── database
├── README.md
└── ORDER_MANAGEMENT_INTEGRATION.md
```

## How to Run

### 1. Run the Authentication System

```bash
npm install
npm run dev
```

Default server:

```text
http://localhost:3000
```

### 2. Run the Delivery Rider Portal Backend

Create a `.env` file inside the `backend` folder using `backend/.env.example`.

```bash
cd backend
npm install
npm start
```

Default server:

```text
http://localhost:5000
```

### 3. Run the Delivery Rider Portal Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the frontend URL shown in the terminal.

## Order Management Connection

The Delivery Rider Portal accepts shipment/order data from the Order Management System using:

```text
POST http://localhost:5000/api/shipments
```

For more details, see:

```text
ORDER_MANAGEMENT_INTEGRATION.md
```

## Integration Status

```text
Authentication System - Integrated
Order Management System - Integrated on Delivery Rider Portal side
Customer Tracking Portal - Prepared endpoint
Notification System - Prepared endpoint
Delivery Performance Monitoring System - Prepared endpoint
Analytics Dashboard System - Prepared endpoint
Return Management System - Pending
```
