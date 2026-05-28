const db = require('../config/db');
const { allowedStatuses } = require('../config/env');
const { notifyConnectedModules } = require('../services/externalService');
const {
  getAssignedDeliveries,
  getDeliveryHistory,
  getDeliveryByIdForRider,
  getDeliveryLogs
} = require('../models/deliveryModel');

async function listDeliveries(req, res) {
  try {
    const deliveries = await getAssignedDeliveries(req.rider.rider_id);
    res.json({ deliveries });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch assigned deliveries.' });
  }
}

async function listHistory(req, res) {
  try {
    const history = await getDeliveryHistory(req.rider.rider_id);
    res.json({ history });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch delivery history.' });
  }
}

async function getDeliveryDetails(req, res) {
  try {
    const delivery = await getDeliveryByIdForRider(req.params.id, req.rider.rider_id);

    if (!delivery) {
      return res.status(404).json({ message: 'Delivery not found.' });
    }

    const logs = await getDeliveryLogs(req.params.id);
    res.json({ delivery, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to fetch delivery details.' });
  }
}

async function updateDeliveryStatus(req, res) {
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
}

async function confirmDelivery(req, res) {
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
}

module.exports = {
  listDeliveries,
  listHistory,
  getDeliveryDetails,
  updateDeliveryStatus,
  confirmDelivery
};
