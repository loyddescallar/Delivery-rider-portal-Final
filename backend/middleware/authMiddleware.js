const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, AUTH_MODE } = require('../config/env');
const { validateExternalRiderToken } = require('../services/authService');

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

module.exports = authMiddleware;
