require('dotenv').config();
const app = require('./app');
const { PORT } = require('./config/env');

app.listen(PORT, () => {
  console.log(`Young Stunna API running on http://localhost:${PORT}`);
});
