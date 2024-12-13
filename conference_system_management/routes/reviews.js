const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Paper = require('../models/Paper');
const {PCMMiddleware} = require('../middleware/PCM'); 

// GET reviews for a specific paper
router.get('/:paperId/view',PCMMiddleware, async (req, res) => {
  try {
    const paperId = req.params.paperId;

    // Find reviews for the specified paper
    const reviews = await Review.find({ paper: paperId })
      .populate('reviewer', 'username') // Assuming 'username' is a field in the User model
      .exec();

    // Return the reviews
    res.json({ reviews });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
