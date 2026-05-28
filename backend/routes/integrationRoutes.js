const express = require('express');
const integrationKeyMiddleware = require('../middleware/integrationKeyMiddleware');
const {
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
} = require('../controllers/integrationController');

const router = express.Router();

router.post('/integrations/orders/assign', integrationKeyMiddleware, assignOrder);
router.get('/integrations/tracking/:trackingNumber', getLegacyTracking);
router.get('/integrations/performance/riders/:riderId', integrationKeyMiddleware, getPerformance);
router.get('/integrations/analytics/summary', integrationKeyMiddleware, getLegacyAnalytics);
router.get('/integrations/notifications/rider/:riderId', integrationKeyMiddleware, getNotifications);

router.post('/delivery-rider/shipments', createShipment);
router.get('/delivery-rider/tracking/:trackingNumber', getTracking);
router.get('/delivery-rider/notifications/:riderId', integrationKeyMiddleware, getNotifications);
router.post('/delivery-rider/notifications', integrationKeyMiddleware, receiveNotification);
router.get('/delivery-rider/performance/:riderId', integrationKeyMiddleware, getPerformance);
router.get('/delivery-rider/analytics/summary', integrationKeyMiddleware, getAnalytics);
router.post('/delivery-rider/returns', integrationKeyMiddleware, receiveReturn);
router.get('/delivery-rider/endpoints', getEndpointList);

module.exports = router;
