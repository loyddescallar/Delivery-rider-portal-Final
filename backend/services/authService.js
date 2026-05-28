const jwt = require('jsonwebtoken');
const { JWT_SECRET, AUTH_SERVICE_URL } = require('../config/env');
const { ensureLocalRiderFromAuthUser } = require('../models/riderModel');

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

module.exports = {
  createToken,
  callAuthService,
  buildAuthUserFromToken,
  validateExternalRiderToken
};
