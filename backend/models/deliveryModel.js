const db = require('../config/db');

async function getAssignedDeliveries(riderId) {
  const [rows] = await db.execute(
    `SELECT * FROM deliveries
     WHERE rider_id = ?
     ORDER BY
       FIELD(status, 'Out for Delivery', 'Pending', 'Delivered', 'Failed'),
       assigned_date DESC`,
    [riderId]
  );
  return rows;
}

async function getDeliveryHistory(riderId) {
  const [rows] = await db.execute(
    `SELECT * FROM deliveries
     WHERE rider_id = ? AND status IN ('Delivered', 'Failed')
     ORDER BY COALESCE(delivered_date, updated_at, assigned_date) DESC`,
    [riderId]
  );
  return rows;
}

async function getDeliveryByIdForRider(deliveryId, riderId) {
  const [rows] = await db.execute(
    'SELECT * FROM deliveries WHERE delivery_id = ? AND rider_id = ?',
    [deliveryId, riderId]
  );
  return rows[0] || null;
}

async function getDeliveryLogs(deliveryId) {
  const [rows] = await db.execute(
    'SELECT * FROM delivery_status_logs WHERE delivery_id = ? ORDER BY updated_at DESC',
    [deliveryId]
  );
  return rows;
}

async function getDeliveryById(deliveryId) {
  const [rows] = await db.execute('SELECT * FROM deliveries WHERE delivery_id = ?', [deliveryId]);
  return rows[0] || null;
}

async function getTrackingStatus(trackingNumber, detailed = false) {
  const query = detailed
    ? `SELECT tracking_number, order_id, recipient_name, recipient_contact, recipient_address,
              item_description, payment_method, total_amount, status, assigned_date, delivered_date, updated_at
       FROM deliveries
       WHERE tracking_number = ?`
    : `SELECT tracking_number, order_id, recipient_name, recipient_address, status,
              assigned_date, delivered_date, updated_at
       FROM deliveries
       WHERE tracking_number = ?`;

  const [rows] = await db.execute(query, [trackingNumber]);
  return rows[0] || null;
}

async function getRiderPerformance(riderId) {
  const [rows] = await db.execute(
    `SELECT
       rider_id,
       COUNT(*) AS total_assigned,
       SUM(status = 'Delivered') AS completed_deliveries,
       SUM(status = 'Failed') AS failed_deliveries,
       SUM(status IN ('Pending', 'Out for Delivery')) AS active_deliveries,
       ROUND(AVG(CASE
         WHEN status = 'Delivered' AND delivered_date IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, assigned_date, delivered_date)
       END), 2) AS average_delivery_minutes
     FROM deliveries
     WHERE rider_id = ?
     GROUP BY rider_id`,
    [riderId]
  );
  return rows[0] || null;
}

async function getAnalyticsSummary() {
  const [summaryRows] = await db.execute(
    `SELECT
       COUNT(*) AS total_deliveries,
       SUM(status = 'Pending') AS pending_deliveries,
       SUM(status = 'Out for Delivery') AS out_for_delivery,
       SUM(status = 'Delivered') AS delivered_deliveries,
       SUM(status = 'Failed') AS failed_deliveries,
       COALESCE(SUM(total_amount), 0) AS total_delivery_amount
     FROM deliveries`
  );

  const [dailyRows] = await db.execute(
    `SELECT DATE(assigned_date) AS delivery_date, COUNT(*) AS total
     FROM deliveries
     GROUP BY DATE(assigned_date)
     ORDER BY delivery_date DESC
     LIMIT 7`
  );

  return { summary: summaryRows[0], daily: dailyRows };
}

async function getActiveNotificationsForRider(riderId) {
  const [rows] = await db.execute(
    `SELECT delivery_id, order_id, tracking_number, status, recipient_name, assigned_date, updated_at
     FROM deliveries
     WHERE rider_id = ? AND status IN ('Pending', 'Out for Delivery')
     ORDER BY updated_at DESC`,
    [riderId]
  );

  return rows.map((delivery) => ({
    riderId: Number(riderId),
    deliveryId: delivery.delivery_id,
    title: delivery.status === 'Pending' ? 'New delivery assigned' : 'Delivery in progress',
    message: `${delivery.tracking_number} for ${delivery.recipient_name} is ${delivery.status}.`,
    type: 'delivery',
    delivery
  }));
}

module.exports = {
  getAssignedDeliveries,
  getDeliveryHistory,
  getDeliveryByIdForRider,
  getDeliveryLogs,
  getDeliveryById,
  getTrackingStatus,
  getRiderPerformance,
  getAnalyticsSummary,
  getActiveNotificationsForRider
};
