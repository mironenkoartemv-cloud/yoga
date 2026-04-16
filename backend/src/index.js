require('dotenv').config();
const { createServer } = require('http');
const app = require('./app');
const { initSocket } = require('./socket/signaling');
const { startScheduler } = require('./jobs/notificationScheduler');

const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);
initSocket(httpServer);
startScheduler();

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 WebSocket signaling ready`);
  console.log(`🌍 ENV: ${process.env.NODE_ENV}`);
});
