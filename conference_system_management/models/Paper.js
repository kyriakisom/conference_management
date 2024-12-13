const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Define the schema for a paper
const paperSchema = new mongoose.Schema({
  identifier: { type: String, default: uuidv4, unique: true }, // Unique identifier for the paper
  creationDate: { type: Date, default: Date.now, required: true }, // Date when the paper was created (required)
  title: { type: String, required: true }, // Title of the paper (required)
  abstract: { type: String, required: true }, // Abstract of the paper (required)
  content: {
    type: String,
    required: function () {
      return this.state === 'SUBMITTED' || this.state === 'REVIEWED';
    },
  }, // Content of the paper, required under certain conditions
  conference: { type: mongoose.Schema.Types.ObjectId, ref: 'Conference', required: false }, // Conference associated with the paper
  authors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', autopopulate: true }], // Authors of the paper
  coauthors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', autopopulate: true }], // Coauthors of the paper
  reviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', autopopulate: true }], // Reviewers assigned to the paper

  state: {
    type: String,
    enum: ['CREATED', 'SUBMITTED', 'REVIEWED', 'REJECTED', 'APPROVED', 'ACCEPTED','FINAL_SUBMIT'],
    default: 'CREATED',
    required: true,
  },// State of the paper, with possible values defined by the enum (default: 'CREATED', required)
}, {
  // Define the options for the schema
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (doc, ret) => {
      // Remove the 'identifier' field
      delete ret.identifier;

      // Rename '_id' to 'id'
      ret.id = ret._id;

      // Remove '_id' field
      delete ret._id;
    }
  },
});
// Create a model for the Paper schema
const Paper = mongoose.model('Paper', paperSchema);

// Export the Paper model
module.exports = Paper;
