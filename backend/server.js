const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3600;
const JWT_SECRET = process.env.JWT_SECRET || 'young_stunna_secret_key_change_me';
const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY || 'demo-integration-key';
const AUTH_MODE = (process.env.AUTH_MODE || 'external').toLowerCase();
const AUTH_SERVICE_URL = (process.env.AUTH_SERVICE_URL || 'http://localhost:3000').replace(/\/+$/, '');

// Future-ready service URLs. Update these in .env when other modules are available.
const SERVICE_URLS = {
  orderManagement: (process.env.ORDER_MANAGEMENT_SERVICE_URL || '').replace(/\/+$/, ''),
  notification: (process.env.NOTIFICATION_SERVICE_URL || '').replace(/\/+$/, ''),
  customerTracking: (process.env.CUSTOMER_TRACKING_SERVICE_URL || '').replace(/\/+$/, ''),
  performanceMonitoring: (process.env.PERFORMANCE_MONITORING_SERVICE_URL || '').replace(/\/+$/, ''),
  analytics: (process.env.ANALYTICS_SERVICE_URL || '').replace(/\/+$/, ''),
  returnManagement: (process.env.RETURN_MANAGEMENT_SERVICE_URL || '').replace(/\/+$/, '')
};

// Future-ready endpoint paths. Change these in .env if the other groups use different route names.
const SERVICE_PATHS = {
  orderAssignments: process.env.ORDER_MANAGEMENT_ASSIGNMENTS_PATH || '/api/orders/assigned',
  notificationCreate: process.env.NOTIFICATION_CREATE_PATH || '/api/notifications',
  customerTrackingUpdate: process.env.CUSTOMER_TRACKING_UPDATE_PATH || '/api/tracking/status',
  performanceRecord: process.env.PERFORMANCE_RECORD_PATH || '/api/performance/deliveries',
  analyticsEvent: process.env.ANALYTICS_EVENT_PATH || '/api/analytics/delivery-events',
  returnCreate: process.env.RETURN_CREATE_PATH || '/api/returns'
};

const allowedStatuses = ['Pending', 'Out for Delivery', 'Delivered', 'Failed'];

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createToken(rider) {
  return jwt.sign(
    { rider_id: rider.rider_id, email: rider.email },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

async function callAuthService(path, options = {}) {
  const response = await fetch(`${AUTH_SERVICE_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    throw new Error(data.message || 'Authentication service request failed.');
  }

  return data;
}

function buildServiceUrl(serviceUrl, path) {
  if (!serviceUrl) return null;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${serviceUrl}${cleanPath}`;
}

async function safePostToService(serviceName, serviceUrl, path, payload) {
  const url = buildServiceUrl(serviceUrl, path);
  if (!url) return { skipped: true, service: serviceName };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    return { service: serviceName, ok: response.ok, status: response.status, data };
  } catch (error) {
    return { service: serviceName, ok: false, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyConnectedModules(delivery, eventType = 'status_update', remarks = '') {
  if (!delivery) return [];

  const payload = {
    eventType,
    orderId: delivery.order_id,
    deliveryId: delivery.delivery_id,
    riderId: delivery.rider_id,
    trackingNumber: delivery.tracking_number,
    recipientName: delivery.recipient_name,
    recipientContact: delivery.recipient_contact,
    deliveryAddress: delivery.recipient_address,
    status: delivery.status,
    remarks,
    updatedAt: new Date().toISOString()
  };

  const tasks = [
    safePostToService('Customer Tracking Portal', SERVICE_URLS.customerTracking, SERVICE_PATHS.customerTrackingUpdate, payload),
    safePostToService('Notification System', SERVICE_URLS.notification, SERVICE_PATHS.notificationCreate, {
      riderId: payload.riderId,
      title: `Delivery ${payload.status}`,
      message: `${payload.trackingNumber} is now ${payload.status}.`,
      type: 'delivery_status',
      data: payload
    }),
    safePostToService('Delivery Performance Monitoring System', SERVICE_URLS.performanceMonitoring, SERVICE_PATHS.performanceRecord, payload),
    safePostToService('Analytics Dashboard System', SERVICE_URLS.analytics, SERVICE_PATHS.analyticsEvent, payload)
  ];

  if (delivery.status === 'Failed') {
    tasks.push(
      safePostToService('Return Management System', SERVICE_URLS.returnManagement, SERVICE_PATHS.returnCreate, {
        ...payload,
        returnReason: remarks || 'Delivery failed.'
      })
    );
  }

  const results = await Promise.all(tasks);
  results
    .filter((result) => result && result.ok === false)
    .forEach((result) => console.warn(`Integration warning: ${result.service}`, result.error || result.status));
  return results;
}

function formatAuthUserName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ')
    || user.full_name
    || user.name
    || 'Authorized Rider';
}

async function ensureLocalRiderFromAuthUser(authUser) {
  if (!authUser) {
    throw new Error('Authentication service did not return user details.');
  }

  const authUserId = Number(authUser.rider_id || authUser.user_id || authUser.id);
  const email = authUser.email || (authUserId ? `rider${authUserId}@auth.local` : `rider-${Date.now()}@auth.local`);

  let rows = [];

  if (email) {
    [rows] = await db.execute(
      'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE email = ?',
      [email]
    );
  }

  if (!rows.length && Number.isInteger(authUserId) && authUserId > 0) {
    [rows] = await db.execute(
      'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE rider_id = ?',
      [authUserId]
    );
  }

  if (rows.length) {
    return rows[0];
  }

  const fullName = formatAuthUserName(authUser);
  const contactNumber = authUser.phoneNumber || authUser.contact_number || 'Not provided';
  const vehicleType = authUser.vehicle_type || 'Motorcycle';
  const plateNumber = authUser.plate_number || 'Not provided';

  if (Number.isInteger(authUserId) && authUserId > 0) {
    try {
      await db.execute(
        `INSERT INTO riders (rider_id, full_name, email, password_hash, contact_number, vehicle_type, plate_number)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [authUserId, fullName, email, hashPassword(`external-${authUserId}-${email}`), contactNumber, vehicleType, plateNumber]
      );
    } catch (error) {
      // If rider_id is already taken, fall back to auto-increment insert below.
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
  }

  [rows] = await db.execute(
    'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE email = ?',
    [email]
  );

  if (!rows.length) {
    await db.execute(
      `INSERT INTO riders (full_name, email, password_hash, contact_number, vehicle_type, plate_number)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullName, email, hashPassword(`external-${Date.now()}-${email}`), contactNumber, vehicleType, plateNumber]
    );

    [rows] = await db.execute(
      'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE email = ?',
      [email]
    );
  }

  return rows[0];
}

function buildAuthUserFromToken(token, emailFromLogin = null) {
  const decoded = jwt.decode(token);

  if (!decoded || decoded.role !== 'rider') {
    throw new Error('Access denied. Only rider accounts can use the Delivery Rider Portal.');
  }

  return {
    id: decoded.id,
    user_id: decoded.id,
    email: emailFromLogin,
    role: decoded.role,
    full_name: emailFromLogin ? emailFromLogin.split('@')[0] : 'Authorized Rider'
  };
}

async function validateExternalRiderToken(token) {
  const authUser = buildAuthUserFromToken(token);
  const rider = await ensureLocalRiderFromAuthUser(authUser);
  return { authUser, rider };
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. Please log in first.' });
    }

    if (AUTH_MODE === 'external') {
      try {
        const decodedLocal = jwt.verify(token, JWT_SECRET);
        const [rows] = await db.execute(
          'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE rider_id = ?',
          [decodedLocal.rider_id]
        );

        if (rows.length) {
          req.rider = rows[0];
          return next();
        }
      } catch (localTokenError) {
        // Not a Delivery Rider Portal token. Try reading it as an Authentication System token.
      }

      const { authUser, rider } = await validateExternalRiderToken(token);
      req.authUser = authUser;
      req.rider = rider;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.execute(
      'SELECT rider_id, full_name, email, contact_number, vehicle_type, plate_number FROM riders WHERE rider_id = ?',
      [decoded.rider_id]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Unauthorized rider account.' });
    }

    req.rider = rows[0];
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message || 'Invalid or expired session. Please log in again.' });
  }
}


function integrationMiddleware(req, res, next) {
  const providedKey = req.headers['x-integration-key'];

  if (providedKey !== INTEGRATION_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized integration request.' });
  }

  next();
}

app.get('/', (req, res) => {
  res.json({ message: 'Young Stunna Delivery Rider Portal API is running.' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (AUTH_MODE === 'external') {
      const loginData = await callAuthService('/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, role: 'rider' })
      });

      if (!loginData.token) {
        return res.status(401).json({ message: 'Authentication service did not return a token.' });
      }

      const authUser = buildAuthUserFromToken(loginData.token, email);
      const rider = await ensureLocalRiderFromAuthUser(authUser);

      return res.json({
        token: createToken(rider),
        externalAuthToken: loginData.token,
        rider,
        authUser,
        authSource: 'Authentication-System-Final'
      });
    }

    const [rows] = await db.execute('SELECT * FROM riders WHERE email = ?', [email]);

    if (!rows.length || rows[0].password_hash !== hashPassword(password)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const rider = rows[0];
    const safeRider = {
      rider_id: rider.rider_id,
      full_name: rider.full_name,
      email: rider.email,
      contact_number: rider.contact_number,
      vehicle_type: rider.vehicle_type,
      plate_number: rider.plate_number
    };

    res.json({ token: createToken(rider), rider: safeRider, authSource: 'local-demo' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error during login.' });
  }
});

app.get('/api/rider/me', authMiddleware, (req, res) => {
  res.json({ rider: req.rider });
});

app.get('/api/deliveries', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM deliveries
       WHERE rider_id = ?
       ORDER BY
         FIELD(status, 'Out for Delivery', 'Pending', 'Delivered', 'Failed'),
         assigned_date DESC`,
      [req.rider.rider_id]
    );

    res.json({ deliveries: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch assigned deliveries.' });
  }
});

app.get('/api/deliveries/history', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM deliveries
       WHERE rider_id = ? AND status IN ('Delivered', 'Failed')
       ORDER BY COALESCE(delivered_date, updated_at, assigned_date) DESC`,
      [req.rider.rider_id]
    );

    res.json({ history: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch delivery history.' });
  }
});

app.get('/api/deliveries/:id', authMiddleware, async (req, res) => {
  try {
    const [deliveryRows] = await db.execute(
      'SELECT * FROM deliveries WHERE delivery_id = ? AND rider_id = ?',
      [req.params.id, req.rider.rider_id]
    );

    if (!deliveryRows.length) {
      return res.status(404).json({ message: 'Delivery not found.' });
    }

    const [logRows] = await db.execute(
      'SELECT * FROM delivery_status_logs WHERE delivery_id = ? ORDER BY updated_at DESC',
      [req.params.id]
    );

    res.json({ delivery: deliveryRows[0], logs: logRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch delivery details.' });
  }
});

app.put('/api/deliveries/:id/status', authMiddleware, async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { status, remarks } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid delivery status.' });
    }

    await connection.beginTransaction();

    const [deliveryRows] = await connection.execute(
      'SELECT * FROM deliveries WHERE delivery_id = ? AND rider_id = ? FOR UPDATE',
      [req.params.id, req.rider.rider_id]
    );

    if (!deliveryRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Delivery not found.' });
    }

    const deliveredDateSql = status === 'Delivered' ? 'NOW()' : 'NULL';

    await connection.execute(
      `UPDATE deliveries
       SET status = ?, delivered_date = ${deliveredDateSql}
       WHERE delivery_id = ? AND rider_id = ?`,
      [status, req.params.id, req.rider.rider_id]
    );

    await connection.execute(
      'INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES (?, ?, ?)',
      [req.params.id, status, remarks || `Status updated to ${status}.`]
    );

    await connection.commit();

    const [updatedRows] = await db.execute(
      'SELECT * FROM deliveries WHERE delivery_id = ? AND rider_id = ?',
      [req.params.id, req.rider.rider_id]
    );

    const delivery = updatedRows[0];
    notifyConnectedModules(delivery, 'status_update', remarks || `Status updated to ${status}.`).catch((error) => {
      console.warn('External integration notification failed:', error.message);
    });

    res.json({ message: 'Delivery status updated successfully.', delivery });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Unable to update delivery status.' });
  } finally {
    connection.release();
  }
});

app.post('/api/deliveries/:id/confirm', authMiddleware, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [deliveryRows] = await connection.execute(
      'SELECT * FROM deliveries WHERE delivery_id = ? AND rider_id = ? FOR UPDATE',
      [req.params.id, req.rider.rider_id]
    );

    if (!deliveryRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: 'Delivery not found.' });
    }

    await connection.execute(
      `UPDATE deliveries
       SET status = 'Delivered', delivered_date = NOW()
       WHERE delivery_id = ? AND rider_id = ?`,
      [req.params.id, req.rider.rider_id]
    );

    await connection.execute(
      'INSERT INTO delivery_status_logs (delivery_id, status, remarks) VALUES (?, ?, ?)',
      [req.params.id, 'Delivered', 'Delivery confirmed successfully.']
    );

    await connection.commit();

    const [updatedRows] = await db.execute(
      'SELECT * FROM deliveries WHERE delivery_id = ? AND rider_id = ?',
      [req.params.id, req.rider.rider_id]
    );

    const delivery = updatedRows[0];
    notifyConnectedModules(delivery, 'delivery_confirmed', 'Delivery confirmed successfully.').catch((error) => {
      console.warn('External integration notification failed:', error.message);
    });

    res.json({ message: 'Delivery confirmed successfully.', delivery });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Unable to confirm delivery.' });
  } finally {
    connection.release();
  }
});


// Integration endpoint for Order Management System.
// Order Management can assign a delivery to a rider using this API.
app.post('/api/integrations/orders/assign', integrationMiddleware, async (req, res) => {
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
});

// Integration endpoint for Customer Tracking Portal.
// Customer Tracking can read delivery status using the tracking number.
app.get('/api/integrations/tracking/:trackingNumber', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT tracking_number, order_id, recipient_name, recipient_address, status,
              assigned_date, delivered_date, updated_at
       FROM deliveries
       WHERE tracking_number = ?`,
      [req.params.trackingNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Tracking number not found.' });
    }

    res.json({ tracking: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch tracking status.' });
  }
});

// Integration endpoint for Delivery Performance Monitoring System.
// Performance Monitoring can get rider delivery counts and average delivery time.
app.get('/api/integrations/performance/riders/:riderId', integrationMiddleware, async (req, res) => {
  try {
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
      [req.params.riderId]
    );

    res.json({ performance: rows[0] || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch rider performance.' });
  }
});

// Integration endpoint for Analytics Dashboard System.
// Analytics can use this summary for charts and reports.
app.get('/api/integrations/analytics/summary', integrationMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         COUNT(*) AS total_deliveries,
         SUM(status = 'Pending') AS pending_deliveries,
         SUM(status = 'Out for Delivery') AS out_for_delivery,
         SUM(status = 'Delivered') AS delivered_deliveries,
         SUM(status = 'Failed') AS failed_deliveries
       FROM deliveries`
    );

    res.json({ summary: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch analytics summary.' });
  }
});

// Integration endpoint for Notification System.
// Notification System can fetch active rider alerts and send/display them separately.
app.get('/api/integrations/notifications/rider/:riderId', integrationMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT delivery_id, tracking_number, status, recipient_name, assigned_date, updated_at
       FROM deliveries
       WHERE rider_id = ? AND status IN ('Pending', 'Out for Delivery')
       ORDER BY updated_at DESC`,
      [req.params.riderId]
    );

    const notifications = rows.map((delivery) => ({
      title: delivery.status === 'Pending' ? 'New delivery assigned' : 'Delivery in progress',
      message: `${delivery.tracking_number} for ${delivery.recipient_name} is ${delivery.status}.`,
      delivery
    }));

    res.json({ notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch rider notifications.' });
  }
});

// Legacy shipment adapter endpoint for Order Management System.
// The Order Management System can set LEGACY_API=http://localhost:3600
// and its convert-to-shipment feature will create a rider delivery here.
app.post('/api/delivery-rider/shipments', async (req, res) => {
  const connection = await db.getConnection();

  try {
    const body = req.body || {};
    const trackingNumber = body.trackingNum || body.tracking_number || body.trackingNumber || `OMS-TRK-${Date.now()}`;
    const riderId = Number(body.rider_id || body.riderId || process.env.DEFAULT_RIDER_ID || 1);
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
      body.recepientName ||
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
});


// Public endpoint for Customer Tracking Portal.
// Other modules can use this to display current delivery status by tracking number.
app.get('/api/delivery-rider/tracking/:trackingNumber', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT tracking_number, order_id, recipient_name, recipient_contact, recipient_address,
              item_description, payment_method, total_amount, status, assigned_date, delivered_date, updated_at
       FROM deliveries
       WHERE tracking_number = ?`,
      [req.params.trackingNumber]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Tracking number not found.' });
    }

    res.json({ tracking: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch tracking status.' });
  }
});

// Endpoint for Notification System.
// Notification module can fetch rider alerts based on active deliveries.
app.get('/api/delivery-rider/notifications/:riderId', integrationMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT delivery_id, order_id, tracking_number, status, recipient_name, assigned_date, updated_at
       FROM deliveries
       WHERE rider_id = ? AND status IN ('Pending', 'Out for Delivery')
       ORDER BY updated_at DESC`,
      [req.params.riderId]
    );

    const notifications = rows.map((delivery) => ({
      riderId: Number(req.params.riderId),
      deliveryId: delivery.delivery_id,
      title: delivery.status === 'Pending' ? 'New delivery assigned' : 'Delivery in progress',
      message: `${delivery.tracking_number} for ${delivery.recipient_name} is ${delivery.status}.`,
      type: 'delivery',
      delivery
    }));

    res.json({ notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch rider notifications.' });
  }
});

// Endpoint for Notification System.
// This receives notification acknowledgements or messages from another module.
app.post('/api/delivery-rider/notifications', integrationMiddleware, async (req, res) => {
  const { riderId, title, message, type = 'general', data = {} } = req.body || {};

  if (!riderId || !title || !message) {
    return res.status(400).json({ message: 'riderId, title, and message are required.' });
  }

  res.status(201).json({
    message: 'Notification payload received by Delivery Rider Portal.',
    notification: { riderId, title, message, type, data }
  });
});

// Endpoint for Delivery Performance Monitoring System.
// Other modules can fetch rider performance summary from this portal.
app.get('/api/delivery-rider/performance/:riderId', integrationMiddleware, async (req, res) => {
  try {
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
      [req.params.riderId]
    );

    res.json({ performance: rows[0] || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch rider performance.' });
  }
});

// Endpoint for Analytics Dashboard System.
// Dashboard module can use this for charts and reports.
app.get('/api/delivery-rider/analytics/summary', integrationMiddleware, async (req, res) => {
  try {
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

    res.json({ summary: summaryRows[0], daily: dailyRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch analytics summary.' });
  }
});

// Endpoint for Return Management System.
// Return module can report failed or returned delivery records.
app.post('/api/delivery-rider/returns', integrationMiddleware, async (req, res) => {
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
});

// Quick endpoint list for classmates.
app.get('/api/delivery-rider/endpoints', (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`Young Stunna API running on http://localhost:${PORT}`);
});
