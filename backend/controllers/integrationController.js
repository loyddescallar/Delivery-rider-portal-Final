const db = require('../config/db');
const { PORT, DEFAULT_RIDER_ID, allowedStatuses } = require('../config/env');
const { notifyConnectedModules } = require('../services/externalService');
const {
  getTrackingStatus,
  getRiderPerformance,
  getAnalyticsSummary,
  getActiveNotificationsForRider
} = require('../models/deliveryModel');

async function assignOrder(req, res) {
  const connection = await db.getConnection();

  try {
    const {
      rider_id = 1,
      order_id,
      tracking_number,
      recipient_name,
      recipient_contact,
      recipient_address,
      item_description,
      payment_method,
      total_amount = 0
    } = req.body;

    if (!tracking_number || !recipient_name || !recipient_contact || !recipient_address) {
      return res.status(400).json({
        message: 'tracking_number, recipient_name, recipient_contact, and recipient_address are required.'
      });
    }

    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO deliveries
       (rider_id, order_id, tracking_number, recipient_name, recipient_contact, recipient_address,
        item_description, payment_method, total_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        rider_id,
        order_id || null,
        tracking_number,
        recipient_name,
        recipient_contact,
        recipient_address,
        item_description || null,
        payment_method || null,
        total_amount
      ]
    );

    await connection.execute(
      'INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES (?, ?, ?)',
      [result.insertId, 'Pending', 'Order Management assigned this delivery to the rider.']
    );

    await connection.commit();

    const [rows] = await db.execute('SELECT * FROM deliveries WHERE delivery_id = ?', [result.insertId]);
    res.status(201).json({ message: 'Delivery assigned successfully.', delivery: rows[0] });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Unable to assign delivery.' });
  } finally {
    connection.release();
  }
}

async function createShipment(req, res) {
  const connection = await db.getConnection();

  try {
    const body = req.body || {};
    const trackingNumber = body.trackingNum || body.tracking_number || body.trackingNumber || `OMS-TRK-${Date.now()}`;
    const riderId = Number(body.rider_id || body.riderId || DEFAULT_RIDER_ID || 1);
    const orderId = body.order_id || body.orderId || body.id || null;
    const rawStatus = body.shipmentStatus || body.status || 'Pending';
    const status = allowedStatuses.includes(rawStatus) ? rawStatus : 'Pending';

    const recipientName =
      body.customerName ||
      body.customer_name ||
      body.recipientName ||
      body.recepientName ||
      'Order Recipient';

    const recipientContact =
      body.customerContact ||
      body.customer_contact ||
      body.recipientContact ||
      body.recipient_contact ||
      body.contactNumber ||
      'Not provided';

    const recipientAddress =
      body.deliveryAddress ||
      body.delivery_address ||
      body.recipientAddress ||
      body.recipient_address ||
      'No delivery address provided';

    const itemDescription =
      body.item_description ||
      body.itemDescription ||
      body.productName ||
      body.packageDescription ||
      (body.packageWeight ? `Package quantity/weight: ${body.packageWeight}` : 'Order package');

    const totalAmount = Number(body.totalPrice || body.total_amount || body.totalAmount || 0);
    const paymentMethod = body.paymentMethod || body.payment_method || 'Not specified';

    if (!trackingNumber || !recipientAddress) {
      return res.status(400).json({ message: 'tracking number and delivery address are required.' });
    }

    await connection.beginTransaction();

    const [existing] = await connection.execute(
      'SELECT * FROM deliveries WHERE tracking_number = ? FOR UPDATE',
      [trackingNumber]
    );

    let deliveryId;

    if (existing.length) {
      deliveryId = existing[0].delivery_id;
      await connection.execute(
        `UPDATE deliveries
         SET rider_id = ?, order_id = COALESCE(?, order_id), recipient_name = ?, recipient_contact = ?,
             recipient_address = ?, item_description = ?, payment_method = ?, total_amount = ?, status = ?
         WHERE delivery_id = ?`,
        [riderId, orderId, recipientName, recipientContact, recipientAddress, itemDescription, paymentMethod, totalAmount, status, deliveryId]
      );

      await connection.execute(
        'INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES (?, ?, ?)',
        [deliveryId, status, 'Order Management updated this shipment through the legacy shipment adapter.']
      );
    } else {
      const [result] = await connection.execute(
        `INSERT INTO deliveries
         (rider_id, order_id, tracking_number, recipient_name, recipient_contact, recipient_address,
          item_description, payment_method, total_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [riderId, orderId, trackingNumber, recipientName, recipientContact, recipientAddress, itemDescription, paymentMethod, totalAmount, status]
      );

      deliveryId = result.insertId;

      await connection.execute(
        'INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES (?, ?, ?)',
        [deliveryId, status, 'Order Management converted this order into a delivery.']
      );
    }

    await connection.commit();

    const [rows] = await db.execute('SELECT * FROM deliveries WHERE delivery_id = ?', [deliveryId]);
    const delivery = rows[0];

    notifyConnectedModules(delivery, existing.length ? 'shipment_updated' : 'shipment_created', 'Order Management sent shipment data.').catch((error) => {
      console.warn('External integration notification failed:', error.message);
    });

    res.status(existing.length ? 200 : 201).json({
      message: existing.length ? 'Shipment updated in Delivery Rider Portal.' : 'Shipment created in Delivery Rider Portal.',
      shipment: delivery,
      delivery
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Unable to create shipment from Order Management System.' });
  } finally {
    connection.release();
  }
}

async function getTracking(req, res) {
  try {
    const tracking = await getTrackingStatus(req.params.trackingNumber, true);

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking number not found.' });
    }

    res.json({ tracking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch tracking status.' });
  }
}

async function getLegacyTracking(req, res) {
  try {
    const tracking = await getTrackingStatus(req.params.trackingNumber, false);

    if (!tracking) {
      return res.status(404).json({ message: 'Tracking number not found.' });
    }

    res.json({ tracking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch tracking status.' });
  }
}

async function getPerformance(req, res) {
  try {
    const performance = await getRiderPerformance(req.params.riderId);
    res.json({ performance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch rider performance.' });
  }
}

async function getAnalytics(req, res) {
  try {
    const analytics = await getAnalyticsSummary();
    res.json(analytics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch analytics summary.' });
  }
}

async function getLegacyAnalytics(req, res) {
  try {
    const analytics = await getAnalyticsSummary();
    res.json({ summary: analytics.summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch analytics summary.' });
  }
}

async function getNotifications(req, res) {
  try {
    const notifications = await getActiveNotificationsForRider(req.params.riderId);
    res.json({ notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch rider notifications.' });
  }
}

function receiveNotification(req, res) {
  const { riderId, title, message, type = 'general', data = {} } = req.body || {};

  if (!riderId || !title || !message) {
    return res.status(400).json({ message: 'riderId, title, and message are required.' });
  }

  res.status(201).json({
    message: 'Notification payload received by Delivery Rider Portal.',
    notification: { riderId, title, message, type, data }
  });
}

async function receiveReturn(req, res) {
  const connection = await db.getConnection();

  try {
    const { trackingNumber, tracking_number, orderId, order_id, reason = 'Return request received.' } = req.body || {};
    const tracking = trackingNumber || tracking_number;
    const order = orderId || order_id;

    if (!tracking && !order) {
      return res.status(400).json({ message: 'trackingNumber or orderId is required.' });
    }

    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT * FROM deliveries
       WHERE (? IS NOT NULL AND tracking_number = ?) OR (? IS NOT NULL AND order_id = ?)
       LIMIT 1 FOR UPDATE`,
      [tracking || null, tracking || null, order || null, order || null]
    );

    if (!rows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Delivery record not found.' });
    }

    const delivery = rows[0];

    await connection.execute(
      `UPDATE deliveries
       SET status = 'Failed', delivered_date = NULL
       WHERE delivery_id = ?`,
      [delivery.delivery_id]
    );

    await connection.execute(
      'INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES (?, ?, ?)',
      [delivery.delivery_id, 'Failed', `Return Management: ${reason}`]
    );

    await connection.commit();

    const [updatedRows] = await db.execute('SELECT * FROM deliveries WHERE delivery_id = ?', [delivery.delivery_id]);
    res.json({ message: 'Return record processed by Delivery Rider Portal.', delivery: updatedRows[0] });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Unable to process return request.' });
  } finally {
    connection.release();
  }
}

function getEndpointList(req, res) {
  res.json({
    service: 'Delivery Rider Portal',
    baseUrl: `http://localhost:${PORT}`,
    integrationKeyHeader: 'x-integration-key',
    endpoints: {
      receiveOrderShipment: 'POST /api/delivery-rider/shipments',
      getTrackingStatus: 'GET /api/delivery-rider/tracking/:trackingNumber',
      getRiderNotifications: 'GET /api/delivery-rider/notifications/:riderId',
      receiveNotification: 'POST /api/delivery-rider/notifications',
      getRiderPerformance: 'GET /api/delivery-rider/performance/:riderId',
      getAnalyticsSummary: 'GET /api/delivery-rider/analytics/summary',
      receiveReturnRequest: 'POST /api/delivery-rider/returns'
    }
  });
}

module.exports = {
  assignOrder,
  createShipment,
  getTracking,
  getLegacyTracking,
  getPerformance,
  getAnalytics,
  getLegacyAnalytics,
  getNotifications,
  receiveNotification,
  receiveReturn,
  getEndpointList
};
