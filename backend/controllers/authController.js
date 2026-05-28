const { AUTH_MODE } = require('../config/env');
const { hashPassword } = require('../utils/password');
const { createToken, callAuthService, buildAuthUserFromToken } = require('../services/authService');
const { ensureLocalRiderFromAuthUser, findRiderWithPasswordByEmail } = require('../models/riderModel');

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    if (AUTH_MODE === 'external') {
      const loginData = await callAuthService('/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    const rider = await findRiderWithPasswordByEmail(email);

    if (!rider || rider.password_hash !== hashPassword(password)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

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
}

module.exports = { login };
