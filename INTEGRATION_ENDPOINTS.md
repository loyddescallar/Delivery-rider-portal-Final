# Delivery Rider Portal Integration Endpoints

Base URL:

```text
http://localhost:3600
```

For protected integration endpoints, send this header:

```text
x-integration-key: demo-integration-key
```

## 1. Order Management System

Use this endpoint to send assigned orders or converted shipments to the rider portal.

```text
POST /api/delivery-rider/shipments
```

Sample body:

```json
{
  "orderId": "ORD-1005",
  "trackingNumber": "YS-TRK-1005",
  "riderId": 1,
  "customerName": "Juan Dela Cruz",
  "customerContact": "09123456789",
  "deliveryAddress": "Balayan, Batangas",
  "productName": "Food Package",
  "paymentMethod": "Cash on Delivery",
  "totalAmount": 500,
  "status": "Pending"
}
```

## 2. Customer Tracking Portal

Use this endpoint to get the current delivery status.

```text
GET /api/delivery-rider/tracking/:trackingNumber
```

Example:

```text
GET http://localhost:3600/api/delivery-rider/tracking/YS-TRK-1005
```

## 3. Notification System

Fetch active rider delivery alerts:

```text
GET /api/delivery-rider/notifications/:riderId
```

Receive a notification payload:

```text
POST /api/delivery-rider/notifications
```

Sample body:

```json
{
  "riderId": 1,
  "title": "New delivery assigned",
  "message": "A new delivery has been assigned to you.",
  "type": "delivery"
}
```

## 4. Delivery Performance Monitoring System

Use this endpoint to get rider delivery performance summary.

```text
GET /api/delivery-rider/performance/:riderId
```

## 5. Analytics Dashboard System

Use this endpoint to get delivery summary data for reports and charts.

```text
GET /api/delivery-rider/analytics/summary
```

## 6. Return Management System

Use this endpoint to send failed or returned delivery records.

```text
POST /api/delivery-rider/returns
```

Sample body:

```json
{
  "trackingNumber": "YS-TRK-1005",
  "reason": "Customer requested return"
}
```

## Environment Variables for Future Connections

Update these values in `backend/.env` when other systems are finished:

```env
ORDER_MANAGEMENT_SERVICE_URL=http://localhost:4000
NOTIFICATION_SERVICE_URL=http://localhost:4100
CUSTOMER_TRACKING_SERVICE_URL=http://localhost:4200
PERFORMANCE_MONITORING_SERVICE_URL=http://localhost:4300
ANALYTICS_SERVICE_URL=http://localhost:4400
RETURN_MANAGEMENT_SERVICE_URL=http://localhost:4500
```
