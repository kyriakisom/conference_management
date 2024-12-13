const express = require('express');
const router = express.Router();
const Conference = require('../models/Conference'); 
const Paper = require('../models/Paper'); 
const {AuthorMiddleware} = require('../middleware/Author'); 
const {PCCMiddleware} = require('../middleware/PCC'); 
const {PCMMiddleware} = require('../middleware/PCM'); 
const User = require('../models/User');
const VisitorMiddleware = require('../middleware/Visitor');

// Endpoint for creating a new conference
router.post('/', PCCMiddleware,async (req, res) => {
  try {
    // Check if the required information is provided in the request body
    const { name, description,pcChairs,pcMembers } = req.body;

    if (!name || !description ||!pcChairs||!pcMembers) {
      return res.status(400).json({ error: 'Name and description are required fields.' });
    }

    // Create a new conference with auto-generated ID and creation date
    const newConference = new Conference({
      name,
      description,
      pcChairs,
      pcMembers
        });

    // Save the conference to the database
    await newConference.save();

    // Respond with the created conference details
    return res.status(201).json(newConference);
  } catch (error) {
    console.error(error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Conference name must be unique.' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint for updating conference details
router.patch('/:id',PCCMiddleware, async (req, res) => {
    const { name, description } = req.body;
    const { id } = req.params;
  
    try {
      const conference = await Conference.findById(id);
  
      if (!conference) {
        return res.json({ message: "Conference not found" });
      }
     // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot start submission. User is not a PC Chair for the conference" });
    }
      if (name) {
        conference.name = name;
      }
  
      if (description) {
        conference.description = description;
      }
  
      const updatedConference = await conference.save();
      res.json(updatedConference);
    } catch (error) {
      res.json({ message: error.message });
    }
  });

  // Endpoint for adding PC Chairs to a conference
  router.post('/:conferenceId/add-pc-chairs', PCCMiddleware, async (req, res) => {
    try {
      const conferenceId = req.params.conferenceId;
      const { pcChairs } = req.body;
  
      // Check if the conference exists
      const conference = await Conference.findById(conferenceId);
      if (!conference) {
        return res.status(404).json({ message: 'Conference not found' });
      }
   // Check if the user is a PC Chair for the conference
   if (!conference.pcChairs.includes(req.user._id)) {
    return res.status(403).json({ message: "Cannot start submission. User is not a PC Chair for the conference" });
  }
      // Ensure pcChairs property is initialized as an array
      conference.pcChairs = conference.pcChairs || [];
  
      // Array to store added PC Chair IDs
      const addedPcChairIds = [];
  
      // Iterate through the provided PC Chairs
      for (const pcChairId of pcChairs) {
        // Check if the user is already a PC Chair for the conference
        if (conference.pcChairs.includes(pcChairId)) {
          // Throw an error if the user is already a PC Chair
          throw new Error(`User ${pcChairId} is already a PC Chair for the conference`);
        }
  
        // Add the PC Chair ID to the conference array
        conference.pcChairs.push(pcChairId);
        addedPcChairIds.push(pcChairId);
      }
  
      // Save the added PC Chair IDs in the addedPcChairIds field in the database
      conference.addedPcChairIds = conference.addedPcChairIds || [];
      conference.addedPcChairIds = [...conference.addedPcChairIds, ...addedPcChairIds];
      
      // Save the updated conference
      await conference.save();
  
      // Create a response object with only the pcChairs field
      const response = {
        message: 'PC Chairs added successfully',
        conference: {
          _id: conference._id,
          name: conference.name,
          pcChairs: conference.pcChairs,
        },
      };
  
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Endpoint for adding PC Members to a conference
  router.post('/:conferenceId/add-pc-members', PCMMiddleware, async (req, res) => {
    try {
      const conferenceId = req.params.conferenceId;
      const { pcMembers } = req.body;
  
      // Check if the conference exists
      const conference = await Conference.findById(conferenceId);
      if (!conference) {
        return res.status(404).json({ message: 'Conference not found' });
      }
   // Check if the user is a PC Chair for the conference
   if (!conference.pcChairs.includes(req.user._id)) {
    return res.status(403).json({ message: "Cannot start submission. User is not a PC Chair for the conference" });
  }
      // Ensure pcMembers property is initialized as an array
      conference.pcMembers = conference.pcMembers || [];
  
      // Array to store added PC Member IDs
      const addedPcMemberIds = [];
  
      // Iterate through the provided PC Members
      for (const pcMemberId of pcMembers) {
        // Check if the user is already a PC Member for the conference
        if (conference.pcMembers.includes(pcMemberId)) {
          // Throw an error if the user is already a PC Member
          throw new Error(`User ${pcMemberId} is already a PC Member for the conference`);
        }
  
        // Add the PC Member ID to the conference array
        conference.pcMembers.push(pcMemberId);
        addedPcMemberIds.push(pcMemberId);
      }
  
      // Save the added PC Member IDs in the addedPcMemberIds field in the database
      conference.addedPcMemberIds = conference.addedPcMemberIds || [];
      conference.addedPcMemberIds = [...conference.addedPcMemberIds, ...addedPcMemberIds];
      
      // Save the updated conference
      await conference.save();
  
      // Create a response object with only the pcMembers field
      const response = {
        message: 'PC Members added successfully',
        conference: {
          _id: conference._id,
          name: conference.name,
          pcMembers: conference.pcMembers,
        },
      };
  
      res.json(response);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
// Route for searching conferences of the PC Chair with search functionality, including papers
router.get('/search', PCCMiddleware, async (req, res) => {
  try {
    const { name, description, pcChair } = req.query;
    let query = { pcChairs: req.user._id };

    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    if (description) {
      query.description = { $regex: description, $options: 'i' };
    }

    if (pcChair) {
      query.pcChairs = { $in: [pcChair] };
    }

    // Find conferences where the user is the PC Chair and match search criteria
    const conferences = await Conference.find(query);

    // Check if the logged-in PC Chair is the PC Chair of the found conferences
    const unauthorizedConferences = conferences.filter(conference => {
      const isPCChair = conference.pcChairs.some(pcChair => pcChair.equals(req.user._id));
      return !isPCChair;
    });

    if (unauthorizedConferences.length > 0) {
      return res.status(403).json({ message: 'Unauthorized: PC Chair cannot have access to conferences they are not responsible for' });
    }

    // Populate conference details after ensuring authorization
    const conferencesDetails = await Conference.populate(conferences, [
      { path: 'pcChairs', select: '_id' },
      { path: 'pcMembers', select: '_id' },
      {
        path: 'papers',
        populate: {
          path: 'authors coauthors reviewers',
          select: 'username -_id',
        },
      },
    ]);

    // Extract relevant information from each conference
    const conferencesResponse = conferencesDetails.map(conference => ({
      id: conference._id,
      creationDate: conference.creationDate,
      name: conference.name,
      description: conference.description,
      pcChairs: conference.pcChairs.map(pcChair => pcChair._id),
      pcMembers: conference.pcMembers.map(pcMember => pcMember._id),
      papers: conference.papers.map(paper => ({
        id: paper._id,
        title: paper.title,
      })),
    }));

    res.json(conferencesResponse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


  // Route for viewing all conferences of the PC Chair with all details, including papers
router.get('/view-all', PCCMiddleware, async (req, res) => {
  try {
    // Find conferences where the user is the PC Chair
    const conferences = await Conference.find({ pcChairs: req.user._id })
      .populate('pcChairs') // Populate PC Chairs without specifying fields to get their ids
      .populate('pcMembers') // Populate PC Members without specifying fields to get their ids
      .populate({
        path: 'papers', // Assuming you have a 'papers' field in your Conference schema that references papers
        populate: {
          path: 'authors coauthors reviewers', // Populate relevant fields within papers
          select: 'username -_id', // Select only the 'username' field for authors, coauthors, and reviewers
        },
      });

    // Check if the user is the PC Chair of any of the conferences
    if (conferences.length === 0) {
      return res.status(403).json({ message: 'Unauthorized: User is not a PC Chair of any conferences' });
    }

    // Extract relevant information from each conference
    const conferencesDetails = conferences.map(conference => ({
      id: conference._id,
      creationDate: conference.creationDate,
      name: conference.name,
      description: conference.description,
      pcChairs: conference.pcChairs.map(pcChair => pcChair._id),
      pcMembers: conference.pcMembers.map(pcMember => pcMember._id),
      papers: conference.papers.map(paper => ({
        id: paper._id,
        title: paper.title,
      })),
    }));

    res.json(conferencesDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Endpoint for deleting a conference
  router.delete('/:id', PCCMiddleware,async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
  
       // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot start submission. User is not a PC Chair for the conference" });
    }
      // Check if the conference is in the initial state (CREATED) for deletion
      if (conference.state !== 'CREATED') {
        return res.status(400).json({ message: "Cannot delete conference. Conference is not in the CREATED state" });
      }
  
      // Perform the deletion using deleteOne
      await Conference.deleteOne({ _id: id });
  
      // Respond with a success message
      res.json({ message: "Conference deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint for starting the submission phase of a conference
  router.patch('/submission-start/:id', PCCMiddleware,async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
   // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
    return res.status(403).json({ message: "Cannot start submission. User is not a PC Chair for the conference" });
  }

      // Check if the conference is in the CREATED state
      if (conference.state !== 'CREATED') {
        return res.status(400).json({ message: "Cannot start submission. Conference is not in the CREATED state" });
      }
  
      // Update the conference state to SUBMISSION
      conference.state = 'SUBMISSION';
  
      // Save the updated conference
      await conference.save();
  
      // Respond with the updated conference details
      res.json(conference);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint for starting the assignment phase of a conference
  router.patch('/assignment-start/:id',PCCMiddleware, async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
  
      // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot start assignment. User is not a PC Chair for the conference" });
    }
      // Check if the conference is in the SUBMISSION state
      if (conference.state !== 'SUBMISSION') {
        return res.status(400).json({ message: "Cannot start assignment. Conference is not in the SUBMISSION state" });
      }
  
      // Update the conference state to ASSIGNMENT
      conference.state = 'ASSIGNMENT';
  
      // Save the updated conference
      await conference.save();
  
      // Respond with the updated conference details
      res.json(conference);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Endpoint for starting the review phase of a conference
  router.patch('/review-start/:id',PCCMiddleware, async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
  
      // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot start review. User is not a PC Chair for the conference" });
    }
      // Check if the conference is in the ASSIGNMENT state
      if (conference.state !== 'ASSIGNMENT') {
        return res.status(400).json({ message: "Cannot start review. Conference is not in the ASSIGNMENT state" });
      }
  
      // Update the conference state to REVIEW
      conference.state = 'REVIEW';
  
      // Save the updated conference
      await conference.save();
  
      // Respond with the updated conference details
      res.json(conference);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint for making a decision on the conference papers
  router.patch('/decision/:id',PCCMiddleware, async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
  
      // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot start decision. User is not a PC Chair for the conference" });
    }
      // Check if the conference is in the REVIEW state
      if (conference.state !== 'REVIEW') {
        return res.status(400).json({ message: "Cannot make a decision. Conference is not in the REVIEW state" });
      }
  
      // Update the conference state to DECISION
      conference.state = 'DECISION';
  
      // Save the updated conference
      await conference.save();
  
      // Respond with the updated conference details
      res.json(conference);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Endpoint for starting the final submission phase of a conference
  router.patch('/final-submission/:id',PCCMiddleware, async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
  
      // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot final submit. User is not a PC Chair for the conference" });
    }
      // Check if the conference is in the DECISION state
      if (conference.state !== 'DECISION') {
        return res.status(400).json({ message: "Cannot start final submission. Conference is not in the DECISION state" });
      }
  
      // Update the conference state to FINAL_SUBMISSION
      conference.state = 'FINAL_SUBMISSION';
  
      // Save the updated conference
      await conference.save();
  
      // Respond with the updated conference details
      res.json(conference);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Endpoint for ending the conference
  router.patch('/end/:id', PCCMiddleware,async (req, res) => {
    const { id } = req.params;
  
    try {
      // Find the conference by ID
      const conference = await Conference.findById(id);
  
      // Check if the conference exists
      if (!conference) {
        return res.status(404).json({ message: "Conference not found" });
      }
  
      // Check if the user is a PC Chair for the conference
     if (!conference.pcChairs.includes(req.user._id)) {
      return res.status(403).json({ message: "Cannot end the conference. User is not a PC Chair for the conference" });
    }
      // Check if the conference is in the FINAL_SUBMISSION state
      if (conference.state !== 'FINAL_SUBMISSION') {
        return res.status(400).json({ message: "Cannot end conference. Conference is not in the FINAL_SUBMISSION state" });
      }
  
      // Update the conference state to FINAL
      conference.state = 'FINAL';
  
      // Save the updated conference
      await conference.save();
  
      // Mark approved papers based on final submission status
      const approvedPapers = await Paper.find({ conference: conference._id, state: 'APPROVED' });
  
      for (const paper of approvedPapers) {
        if (paper.finalSubmission) {
          // Mark the paper as ACCEPTED
          paper.state = 'ACCEPTED';
        } else {
          // Mark the paper as REJECTED
          paper.state = 'REJECTED';
        }
  
        // Save the updated paper
        await paper.save();
      }
  
      // Respond with the updated conference details
      res.json(conference);
      res.json({ message: "Conference ended successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });
  
module.exports = router;
