/**
 * config/db.js — MongoDB Connection Setup
 *
 * Exports a single async function `connectDB` that:
 *  - Reads the MONGO_URI connection string from process.env
 *  - Attempts to connect to MongoDB using Mongoose
 *  - Logs the connected host on success
 *  - Logs the error message and terminates the Node process on failure
 *    (process.exit(1) ensures the app doesn't run without a database)
 *
 * Usage: called once at startup in server.js before routes are mounted.
 */

const mongoose = require('mongoose');

/**
 * connectDB
 * Establishes a Mongoose connection to the MongoDB database specified by
 * the MONGO_URI environment variable. Terminates the process on error.
 */
const connectDB = async () => {
  try {
    // Connect using the URI defined in .env (e.g. MongoDB Atlas or local)
    const conn = await mongoose.connect(process.env.MONGO_URI);

    // Print the connected host for confirmation in the console
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Log the error and exit; a failed DB connection makes the app unusable
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
