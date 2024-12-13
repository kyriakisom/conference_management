const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Define the schema for a conference
const conferenceSchema = new mongoose.Schema({
  creationDate: { type: Date, default: Date.now }, // Date when the conference was created
  name: { type: String, required: true }, // Name of the conference (required)
  description: { type: String, required: true }, // Description of the conference (required)
  pcChairs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Program Committee (PC) Chairs
  pcMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Program Committee (PC) Members
  state: {
    type: String,
    enum: ['CREATED', 'SUBMISSION', 'ASSIGNMENT', 'REVIEW', 'DECISION', 'FINAL_SUBMISSION', 'FINAL'],
    default: 'CREATED',
  },// State of the conference, with possible values defined by the enum (default: 'CREATED')
  papers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Paper', autopopulate: true }],// Papers associated with the conference

});

// Create a model for the Conference schema
const Conference = mongoose.model('Conference', conferenceSchema);

// Export the Conference model
module.exports = Conference;
