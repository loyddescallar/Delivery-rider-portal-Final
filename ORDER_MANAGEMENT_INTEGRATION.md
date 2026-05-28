# Order Management Integration

The Order Management System can send converted orders or shipments to the Delivery Rider Portal.

## Endpoint

```text
POST http://localhost:3600/api/delivery-rider/shipments
```

## Sample Body

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

## Notes

- If no rider ID is sent, the system uses `DEFAULT_RIDER_ID` from `.env`.
- The endpoint can create a new delivery or update an existing one using the tracking number.
