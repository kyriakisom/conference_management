const mongoose = require('mongoose');

// Define the schema for a user
const userSchema = mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId, // Unique identifier for the user
  username: {
    type: String,
    unique: true, // Ensure username uniqueness
  },
  password: {
    type: String,
  },
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  roles: [
    {
      type: String,
      enum: ['visitor', 'author', 'pc chair', 'pc member'], // Allowed roles for a user
    },
  ],
});

// Create a model for the User schema
const User = mongoose.model('User', userSchema);

// Export the User model
module.exports = User;
