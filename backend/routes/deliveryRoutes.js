const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  listDeliveries,
  listHistory,
  getDeliveryDetails,
  updateDeliveryStatus,
  confirmDelivery
} = require('../controllers/deliveryController');

const router = express.Router();

router.get('/', authMiddleware, listDeliveries);
router.get('/history', authMiddleware, listHistory);
router.get('/:id', authMiddleware, getDeliveryDetails);
router.put('/:id/status', authMiddleware, updateDeliveryStatus);
router.post('/:id/confirm', authMiddleware, confirmDelivery);

module.exports = router;
