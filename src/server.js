// src/server.js
// Load .env into process.env early so Prisma and other modules see variables
try {
	require('dotenv').config();
} catch (e) {
	// dotenv may not be installed in some environments (e.g., production where env vars are set)
}

const app = require('./app');

// Export app for serverless platforms (Vercel) and tests
module.exports = app; // Vercel espera isso

// If this file is run directly (node src/server.js), start the HTTP server
if (require.main === module) {
	const port = process.env.PORT || 3333;
	app.listen(port, () => {
		// eslint-disable-next-line no-console
		console.log(`Server listening on port ${port}`);
	});
}
