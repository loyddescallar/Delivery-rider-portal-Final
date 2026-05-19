const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'young_stunna_secret_key_change_me';
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

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized. Please log in first.' });
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
    return res.status(401).json({ message: 'Invalid or expired session. Please log in again.' });
  }
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

    res.json({ token: createToken(rider), rider: safeRider });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login.' });
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

    res.json({ message: 'Delivery status updated successfully.', delivery: updatedRows[0] });
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

    res.json({ message: 'Delivery confirmed successfully.', delivery: updatedRows[0] });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'Unable to confirm delivery.' });
  } finally {
    connection.release();
  }
});

app.listen(PORT, () => {
  console.log(`Young Stunna API running on http://localhost:${PORT}`);
});
