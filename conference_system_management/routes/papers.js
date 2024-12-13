const express = require('express');
const router = express.Router();
const Paper = require('../models/Paper');
const Conference = require('../models/Conference');
const {AuthorMiddleware} = require('../middleware/Author'); 
const {PCCMiddleware} = require('../middleware/PCC'); 
const {PCMMiddleware} = require('../middleware/PCM'); 
const VisitorMiddleware = require('../middleware/Visitor');
const User = require('../models/User');
const Review = require('../models/Review'); 

// Route for creating a new paper
router.post('/',AuthorMiddleware, async (req, res) => {
  try {
    const { title, abstract, content,authors,coauthors,reviewers } = req.body;
    // Automatically produce paper identifier and creation date
    const paper = new Paper({
      title,
      abstract,
      content,
      authors,
      coauthors,
      reviewers
    });

    const savedPaper = await paper.save();

    res.json(savedPaper);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route for updating a paper 
router.patch('/:id',AuthorMiddleware, async (req, res) => {
  const { title, abstract, content,authors } = req.body;
  const { id } = req.params;

  try {
    const paper = await Paper.findById(id);

    if (!paper) {
      return res.json({ message: "Paper not found" });
    }

    // Assuming 'state' is a field that prevents modification in certain states
    if (paper.state === 'SUBMITTED' || paper.state === 'REVIEWED') {
      return res.json({ message: "Cannot modify paper in SUBMITTED or REVIEWED state" });
    }

    if (title) {
      paper.title = title;
    }

    if (abstract) {
      paper.abstract = abstract;
    }

    if (content) {
      paper.content = content;
    }

    if (authors) {
      paper.authors = authors;
    }
    const updatedPaper = await paper.save();
    res.json(updatedPaper);
  } catch (error) {
    res.json({ message: error.message });
  }
});

// Route for adding coauthors to a paper 
router.post('/:paperId/add-coauthors', AuthorMiddleware, async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const { coAuthorsToAdd } = req.body;

    
    // Check if the paper exists
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    // Ensure coauthors property is initialized as an array
    paper.coauthors = paper.coauthors || [];

    // Array to store added Co-Author IDs
    const addedCoAuthorIds = [];

    // Iterate through the provided Co-Authors to add
    for (const coAuthorId of coAuthorsToAdd) {
      // Check if the Co-Author is already added as a coauthor
      if (paper.coauthors.includes(coAuthorId)) {
        throw new Error(`User ${coAuthorId} is already associated with the paper as a coauthor`);
      }
    
     
      // Check if the Co-Author's name is included in the paper's authors array
      const coAuthorName = (await User.findById(coAuthorId)).name; // Assuming user documents have a 'name' field
    
      // Add the Co-Author ID to the paper's coauthors array
      paper.coauthors.push(coAuthorId);

      addedCoAuthorIds.push(coAuthorId);
    }

    // Save the added Co-Author IDs in the addedCoAuthorIds field in the database
    paper.addedCoAuthorIds = paper.addedCoAuthorIds || [];
    paper.addedCoAuthorIds = [...paper.addedCoAuthorIds, ...addedCoAuthorIds];
    
    // Save the updated paper
    await paper.save();

    // Create a response object with only the coAuthors field
    const response = {
      message: 'Co-Authors added successfully',
      paper: {
        _id: paper._id,
        title: paper.title,
        coAuthors: paper.coauthors,
      },
    };

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route for submitting a paper to a conference 
router.patch('/submit/:conferenceId/:paperId', AuthorMiddleware, async (req, res) => {
  const { conferenceId, paperId } = req.params;

  try {
    const paper = await Paper.findById(paperId);

    if (!paper) {
      return res.json({ message: "Paper not found" });
    }

    // Check if the conferenceId is provided
    if (!conferenceId) {
      return res.status(400).json({ message: 'Conference ID is required' });
    }

    const conference = await Conference.findById(conferenceId);

    if (!conference) {
      return res.json({ message: "Conference not found for the paper" });
    }

    // Check if the conference is in FINAL_SUBMISSION or FINAL state
    if (conference.state === 'FINAL_SUBMISSION' || conference.state === 'FINAL') {
      return res.json({ message: "Paper submission is not allowed for conferences in FINAL_SUBMISSION or FINAL state" });
    }

    // Check if the paper content is not empty
    if (!paper.content || paper.content.trim() === '') {
      return res.json({ message: "Paper content cannot be empty for submission" });
    }

    // Assuming 'state' is a field that prevents submission in certain states
    if (paper.state === 'SUBMITTED' || paper.state === 'REVIEWED') {
      return res.json({ message: "Paper has already been submitted or reviewed" });
    }

    // Update the paper's conference field
    paper.conference = conferenceId;

    // Update the paper's state to 'SUBMITTED'
    paper.state = 'SUBMITTED';

    const updatedPaper = await paper.save();
    conference.papers.push(updatedPaper._id);
    await conference.save();
    res.json({ message: "Paper submitted successfully", paper: updatedPaper });
  } catch (error) {
    res.json({ message: error.message });
  }
});

// Route for assigning a reviewer to a paper
router.post('/:paperId/assign-reviewer', PCCMiddleware, async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const { reviewerId } = req.body;

    // Check if the paper exists
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    // Check if the conference is in the ASSIGNMENT state
    const conference = await Conference.findById(paper.conference);
    if (!conference || conference.state !== 'ASSIGNMENT') {
      return res.status(400).json({ message: 'Reviewer assignment is only allowed in the ASSIGNMENT state of the conference' });
    }

    // Check if the reviewer is a member of the Programme Committee (PC)
    const reviewer = await User.findById(reviewerId);
    if (!reviewer || !reviewer.roles.includes('pc chair')) {
      return res.status(400).json({ message: 'Reviewer must be a member of the Programme Committee (PC)' });
    }

    // Check if the maximum number of reviewers has not been reached
    const maxReviewers = 2; // Set the maximum number of reviewers
    if (paper.reviewers.length >= maxReviewers) {
      return res.status(400).json({ message: 'Maximum number of reviewers reached for this paper' });
    }

    // Check if the reviewer is not already assigned to the paper
    if (paper.reviewers.includes(reviewerId)) {
      return res.status(400).json({ message: 'Reviewer is already assigned to this paper' });
    }

    // Assign the reviewer to the paper
    paper.reviewers.push(reviewerId);

    // Save the updated paper
    await paper.save();

    // Create a response object with the assigned reviewers
    const response = {
      message: 'Reviewer assigned successfully',
      paper: {
        _id: paper._id,
        title: paper.title,
        reviewers: paper.reviewers,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Route for submitting a review for a paper
router.post('/:paperId/review', [PCCMiddleware,PCMMiddleware ],async (req, res) => {
  try {
    const paperId = req.params.paperId;
    const { score, justification } = req.body;

    // Check if the paper exists
    const paper = await Paper.findById(paperId);
    if (!paper) {
      return res.status(404).json({ message: 'Paper not found' });
    }

    // Check if the conference is in the REVIEW state
    const conference = await Conference.findById(paper.conference);
    if (!conference || conference.state !== 'REVIEW') {
      return res.status(400).json({ message: 'Paper review not allowed. Conference is not in REVIEW state.' });
    }

    // Check if the user is a PC member or PC chair
    if (!(req.user.roles.includes('pc chair') || req.user.roles.includes('pc member'))) {
      return res.status(403).json({ message: 'Paper review not allowed. User is not a PC chair or PC member.' });
    }

    // Check if the paper has not been reviewed by another assigned PC member
    const existingReview = await Review.findOne({ paper: paperId });
    if (existingReview) {
      return res.status(400).json({ message: 'Paper has already been reviewed by another assigned PC member.' });
    }

    // Create a new review 
    const newReview = new Review({
      paper: paperId,
      reviewer: req.user._id,
      score,
      justification,
    });

    // Save the review to the database
    const savedReview = await newReview.save();

    res.json({ message: 'Paper review submitted successfully', review: savedReview });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Patch route accessible only by PC Chair for approving a paper
router.patch('/approve/:id', PCCMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const paper = await Paper.findById(id);

    if (!paper) {
      return res.json({ message: "Paper not found" });
    }

    const conference = await Conference.findById(paper.conference);

    if (!conference) {
      return res.json({ message: "Conference not found for the paper" });
    }

    // Check if the conference is in the DECISION state
    if (conference.state !== 'DECISION') {
      return res.json({ message: "Cannot approve paper. Conference is not in the DECISION state" });
    }

    // Check if the PC Chair is responsible for the conference
    if (!conference.pcChairs.includes(req.user._id)) {
      return res.json({ message: "Cannot approve paper. PC Chair is not responsible for the conference" });
    }

    // Update the state to APPROVED
    paper.state = 'APPROVED';
    await paper.save();

    res.json({ message: "Paper approved successfully" });
  } catch (error) {
    res.json({ message: error.message });
  }

});

// Patch route accessible only by PC Chair for rejecting a paper
router.patch('/reject/:id', PCCMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const paper = await Paper.findById(id);

    if (!paper) {
      return res.json({ message: "Paper not found" });
    }

    const conference = await Conference.findById(paper.conference);

    if (!conference) {
      return res.json({ message: "Conference not found for the paper" });
    }

    // Check if the conference is in the DECISION state
    if (conference.state !== 'DECISION') {
      return res.json({ message: "Cannot reject paper. Conference is not in the DECISION state" });
    }

    // Assuming 'state' is a field that prevents rejection in certain states
    if (paper.state === 'REJECTED' || paper.state === 'APPROVED' || paper.state === 'ACCEPTED') {
      return res.json({ message: "Paper has already been rejected, approved, or accepted" });
    }

    // Check if the PC Chair is responsible for the conference
    if (!conference.pcChairs.includes(req.user._id)) {
      return res.json({ message: "Cannot reject paper. PC Chair is not responsible for the conference" });
    }

    // Update the state to REJECTED
    paper.state = 'REJECTED';
    const updatedPaper = await paper.save();

    res.json(updatedPaper);
     res.json({ message: "Paper rejected successfully" });
  } catch (error) {
    res.json({ message: error.message });
  }
});
// Route for final submission of a paper
router.patch('/final-submit/:id', AuthorMiddleware,async (req, res) => {
  const { id } = req.params;

  try {
    // Find the paper by ID
    const paper = await Paper.findById(id);

    if (!paper) {
      return res.json({ message: "Paper not found" });
    }

    // Find the conference associated with the paper
    const conference = await Conference.findById(paper.conference);

    if (!conference) {
      return res.json({ message: "Conference not found for the paper" });
    }

    // Check if the conference is in the FINAL_SUBMISSION state
    if (conference.state !== 'FINAL_SUBMISSION') {
      return res.json({ message: "Cannot perform final submission. Conference is not in the FINAL_SUBMISSION state" });
    }

    // Check if the paper has been approved
    if (paper.state !== 'APPROVED') {
      return res.json({ message: "Cannot perform final submission. Paper is not in the APPROVED state" });
    }

    // Update the paper state to ACCEPTED
    paper.state = 'FINAL_SUBMIT';

    // Save the updated paper
    const updatedPaper = await paper.save();

    res.json(updatedPaper);
  } catch (error) {
    res.json({ message: error.message });
  }
});

// Patch route accessible only by PC Chair for accepting a paper
router.patch('/accept/:id', PCCMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the paper by ID
    const paper = await Paper.findById(id);

    if (!paper) {
      return res.json({ message: "Paper not found" });
    }

    // Find the conference associated with the paper
    const conference = await Conference.findById(paper.conference);

    if (!conference) {
      return res.json({ message: "Conference not found for the paper" });
    }

    // Check if the conference is in the FINAL state
    if (conference.state !== 'FINAL') {
      return res.json({ message: "Cannot accept paper. Conference is not in the FINAL state" });
    }

    // Check if the paper is in the FINAL_SUBMIT state
    if (paper.state !== 'FINAL_SUBMIT') {
      return res.json({ message: "Cannot accept paper. Paper is not in the FINAL_SUBMIT state" });
    }

    // Check if the PC Chair is responsible for the conference
    if (!conference.pcChairs.includes(req.user._id)) {
      return res.json({ message: "Cannot accept paper. PC Chair is not responsible for the conference" });
    }

    // Update the paper state to ACCEPTED
    paper.state = 'ACCEPTED';

    // Save the updated paper
    const updatedPaper = await paper.save();

    res.json(updatedPaper);
  } catch (error) {
    res.json({ message: error.message });
  }
});
// Route for searching papers
router.get('/search', VisitorMiddleware, async (req, res) => {
  const { title, authors, abstract } = req.query;

  try {
    let query = {};

    if (title || authors || abstract) {
      // Build the search query based on provided parameters
      if (title) {
        query.title = { $regex: title, $options: 'i' };
      }

      if (authors) {
        query.authors = { $all: authors.split(' ') };
      }

      if (abstract) {
        query.abstract = { $regex: abstract, $options: 'i' };
      }
    } else {
      // No search parameters provided, return all papers in ACCEPTED state
      const allPapers = await Paper.find({ state: 'ACCEPTED' })
        .sort({ title: 'asc' }); // Sort based on the paper title

      return res.json(allPapers);
    }

    // Find papers based on the search query and in ACCEPTED state
    const papers = await Paper.find({ ...query, state: 'ACCEPTED' })
      .select('title abstract creationDate authors state -_id') // Project only required fields
      .sort({ title: 'asc' }); // Sort based on the paper title

    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Paper search route with role-based filtering for author/coauthor
router.get('/search', AuthorMiddleware, async (req, res) => {
  const { title, abstract } = req.query;

  try {
    // Find papers where the user is the AUTHOR or a COAUTHOR
    const papers = await Paper.find({
      $or: [
        { authors: req.user._id },
        { coauthors: req.user._id }
      ]
    })
      .populate('authors', 'username') // Populate author usernames
      .populate('coauthors', 'username'); // Populate coauthor usernames

    // Check if the user is the AUTHOR or a COAUTHOR of any of the papers
    const unauthorizedPapers = papers.filter(paper => {
      const isAuthor = paper.authors.some(author => author._id.equals(req.user._id));
      const isCoauthor = paper.coauthors.some(coauthor => coauthor._id.equals(req.user._id));
      return !isAuthor && !isCoauthor;
    });

    if (unauthorizedPapers.length > 0) {
      return res.status(403).json({ message: 'Unauthorized: User is not an AUTHOR or COAUTHOR of some papers' });
    }

    // Apply additional search filters if provided
    let filteredPapers = papers;
    if (title) {
      filteredPapers = filteredPapers.filter(paper => paper.title.toLowerCase().includes(title.toLowerCase()));
    }

    if (abstract) {
      filteredPapers = filteredPapers.filter(paper => paper.abstract.toLowerCase().includes(abstract.toLowerCase()));
    }

    // Extract relevant information from each paper
    const papersDetails = filteredPapers.map(paper => ({
      id: paper._id,
      title: paper.title,
      content: paper.content,
      status: paper.state,
    }));

    res.json(papersDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route for viewing papers by a visitor
router.get('/view', VisitorMiddleware, async (req, res) => {
  const { title, abstract } = req.query;

  try {
    // Set the default condition to retrieve only papers with the state "ACCEPTED"
    let query = { state: 'ACCEPTED' };

    if (title || abstract) {
      // Search by title and/or abstract
      if (title) {
        query.title = { $regex: title, $options: 'i' };
      }

      if (abstract) {
        query.abstract = { $regex: abstract, $options: 'i' };
      }
    }

    // Find papers based on the search criteria, the state "ACCEPTED," and project only required fields (excluding _id)
    const papers = await Paper.find(query)
      .select('-_id title abstract creationDate authors')
      .sort({ title: 'asc' });

    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route for viewing papers by a PC member
router.get('/view/pcmember', PCMMiddleware, async (req, res) => {
  const { title, abstract, content } = req.query;

  try {
    // Set the default condition to retrieve only papers with the state "ACCEPTED"
    let query = { state: 'ACCEPTED' };

    if (title || abstract || content) {
      // Search by title and/or abstract
      if (title) {
        query.title = { $regex: title, $options: 'i' };
      }

      if (abstract) {
        query.abstract = { $regex: abstract, $options: 'i' };
      }
    
      if (content) {
        query.content = { $regex: content, $options: 'i' };
      }
    }

    // Find papers based on the search criteria, the state "ACCEPTED," and project only required fields (excluding _id)
    const papers = await Paper.find(query)
      .select('-_id title abstract content creationDate authors')
      .sort({ title: 'asc' });

    res.json(papers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route for viewing all papers of the author or coauthor
router.get('/view-all', AuthorMiddleware, async (req, res) => {
  try {
    // Find papers where the user is the AUTHOR or a COAUTHOR
    const papers = await Paper.find({
      $or: [
        { authors: req.user._id },
        { coauthors: req.user._id }
      ]
    })
      .populate('authors', 'username') // Populate author usernames
      .populate('coauthors', 'username'); // Populate coauthor usernames

    // Check if the user is the AUTHOR or a COAUTHOR of any of the papers
    const unauthorizedPapers = papers.filter(paper => {
      const isAuthor = paper.authors.some(author => author._id.equals(req.user._id));
      const isCoauthor = paper.coauthors.some(coauthor => coauthor._id.equals(req.user._id));
      return !isAuthor && !isCoauthor;
    });

    if (unauthorizedPapers.length > 0) {
      return res.status(403).json({ message: 'Unauthorized: User is not an AUTHOR or COAUTHOR of some papers' });
    }

    // Extract relevant information from each paper
    const papersDetails = papers.map(paper => ({
      id: paper._id,
      title: paper.title,
      content: paper.content,
      status: paper.state,
    }));

    res.json(papersDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Route for withdrawing a paper from the conference
router.delete('/withdraw/:id', AuthorMiddleware,async (req, res) => {
  const { id } = req.params;

  try {
    // Find the paper by ID and remove it
    const result = await Paper.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Paper not found" });
    }

    res.json({ message: "Paper has been withdrawn and deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router;
