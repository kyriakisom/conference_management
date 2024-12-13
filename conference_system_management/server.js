const http = require('http');
const app = require('./app');

// Define the port to listen on, using the provided port or default to 3000
const port = process.env.PORT || 3000;

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Start listening on the specified port
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
