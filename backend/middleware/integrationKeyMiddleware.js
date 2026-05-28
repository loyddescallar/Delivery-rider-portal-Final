const { INTEGRATION_API_KEY } = require('../config/env');

function integrationKeyMiddleware(req, res, next) {
  const providedKey = req.headers['x-integration-key'];

  if (providedKey !== INTEGRATION_API_KEY) {
    return res.status(401).json({ message: 'Unauthorized integration request.' });
  }

  next();
}

module.exports = integrationKeyMiddleware;
