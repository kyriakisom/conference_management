const express = require('express');
const router = express.Router();
const { Author } = require('../middleware/Author');
const Visitor = require('../middleware/Visitor');
const {PCMMiddleware} = require('../middleware/PCM');
const {PCCMiddleware} = require('../middleware/PCC');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/User');

// Signup route to create a new user
router.post('/signup', (req, res, next) => {
  User.find({ username: req.body.username })
    .exec()
    .then(user => {
      if (user.length >= 1) {
        return res.status(409).json({
          message: 'Username already exists'
        });
      } else {
        const allowedRoles = ['author', 'pc chair', 'pc member'];

        // Check if req.body.role is defined and is a valid role
        if (!req.body.role || !allowedRoles.includes(req.body.role.toLowerCase())) {
          return res.status(400).json({
            message: 'Invalid role. Role must be "author", "pc chair", or "pc member"'
          });
        }

        bcrypt.hash(req.body.password, 10, (err, hash) => {
          if (err) {
            return res.status(500).json({
              error: err
            });
          } else {
            const newUser = new User({
              _id: new mongoose.Types.ObjectId(),
              username: req.body.username,
              password: hash,
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              roles: req.body.role.toLowerCase() // Convert to lowercase
            });

            newUser
              .save()
              .then(result => {
                // Include user details in the response
                const userResponse = {
                  id: result._id,
                  username: result.username,
                  firstName: result.firstName,
                  lastName: result.lastName,
                  roles: result.roles
                };

                res.status(201).json({
                  message: 'User created successfully',
                  user: userResponse
                });
              })
              .catch(err => {
                console.log(err);
                res.status(500).json({
                  error: err
                });
              });
          }
        });
      }
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({
        error: err
      });
    });
});

// Login route for user authentication
router.post('/login', (req, res, next) => {
  User.findOne({ username: req.body.username })
    .exec()
    .then(user => {
      if (!user) {
        console.log('User not found');
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      bcrypt.compare(req.body.password, user.password, (err, result) => {
        if (err) {
          console.log(err);
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (result) {
          console.log('Password matched');

          const token = jwt.sign(
            {
              username: user.username,
              _id: user._id,
              roles: user.roles || [] // Ensure user.roles is an array or set to an empty array
            },
            process.env.JWT_KEY,
            {
              expiresIn: '1h'
            },
          );

          return res.status(200).json({
            message: 'Authentication successful',
            token: token
          });
        } else {
          console.log('Password not matched');
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      });
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: err });
    });
});


// Create a POST endpoint for creating visitor users
router.post('/connect-as-visitor', async (req, res) => {
  try {
    // Check if there is an existing visitor user with a null username
    const existingVisitor = await User.findOne({ username: null });

    if (existingVisitor) {
      // If an existing visitor user is found, return it without creating a new user
      return res.json({ message: 'Visitor connected successfully', savedVisitor: existingVisitor });
    }

    // Create a new visitor user with the role "visitor" and default values for required fields
    const visitor = new User({
      _id: new mongoose.Types.ObjectId(), // Generate a new _id
      role: 'visitor',
      username: null, // Set username as null
      password: null, // Set password as null
      firstName: null, // Set firstName as null
      lastName: null, // Set lastName as null
    });

    // Save the visitor user to the database
    const savedVisitor = await visitor.save();

    // Return the modified savedVisitor object
    res.json({ message: 'Visitor connected successfully', savedVisitor });
  } catch (error) {
    // Check if the error is a duplicate key error for username
    if (error.code === 11000 && error.keyValue && error.keyValue.username === null) {
      return res.status(400).json({ message: 'Visitor connection failed. Duplicate key error.' });
    }

    // Handle any other errors that occur during the process
    res.status(500).json({ message: error.message });
  }
});
// Logout route
router.post('/logout', PCMMiddleware, async (req, res) => {
  try {
    const userId = req.user._id; // Assuming your authentication middleware sets req.user with user details

    // Clear the user's token in the database
    const user = await User.findById(userId);
    if (user) {
      user.tokens = [];
      await user.save();
    }

    // Clear the user details in the request
    req.user = null;

    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout failed:', error.message);
    res.status(500).json({ success: false, message: 'Logout failed', error: error.message });
  }
});
module.exports = router;