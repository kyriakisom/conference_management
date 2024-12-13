const mongoose = require('mongoose');

// Define the schema for a review
const reviewSchema = new mongoose.Schema({
  paper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Paper',  // Reference to the Paper model
    required: true,
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model representing the reviewer
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  justification: {
    type: String,
    required: true,
  },
}, { timestamps: true }); // Enable automatic timestamps for createdAt and updatedAt

// Create a model for the Review schema
const Review = mongoose.model('Review', reviewSchema);

// Export the Review model
module.exports = Review;
