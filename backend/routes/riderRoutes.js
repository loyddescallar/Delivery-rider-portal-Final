const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getCurrentRider } = require('../controllers/riderController');

const router = express.Router();

router.get('/me', authMiddleware, getCurrentRider);

module.exports = router;
