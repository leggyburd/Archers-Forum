/*
  Main server file for Archers Forum API, responsible for connecting to MongoDB and starting the Express server
*/

const mongoose = require('mongoose');
const dns = require('dns');
const { createApp } = require('./app');
const { PORT, MONGO_URI, MONGO_DB_NAME, MONGO_DNS_SERVERS } = require('./config');
const { ensureAdminAccount } = require('./services/adminAccount');

const app = createApp();
const mongoOptions = {
  dbName: MONGO_DB_NAME,
  serverApi: {
    version: mongoose.mongo.ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

const dnsServers = (MONGO_DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length > 0) {
  dns.setServers(dnsServers);
}

mongoose
  .connect(MONGO_URI, mongoOptions)
  .then(() => {
    console.log('Connected to MongoDB');
    ensureAdminAccount()
      .then(() => {
        const server = app.listen(PORT, () => {
          console.log(`Server running at http://localhost:${PORT}`);
        });

        server.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use.`);
            console.error('Stop the process using that port, or run with a different one.');
            process.exit(1);
          }

          console.error('Server startup error:', err.message);
          process.exit(1);
        });
      })
      .catch((err) => {
        console.error('Failed to ensure admin account:', err.message);
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
