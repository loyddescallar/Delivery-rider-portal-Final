const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const riderRoutes = require('./routes/riderRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const integrationRoutes = require('./routes/integrationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Young Stunna Delivery Rider Portal API is running.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api', integrationRoutes);

module.exports = app;
