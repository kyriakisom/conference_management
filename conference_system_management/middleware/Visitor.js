const Visitor = (req, res, next) => {
  // Check if req.user exists and has the roles property
  if (req.user && req.user.roles && req.user.roles.includes('visitor')) {
    // User is a visitor, continue to the next middleware or route handler
    next();
  } else if (!req.user) {
    // If req.user does not exist, treat it as a visitor
    req.user = { roles: ['visitor'] };
    next();
  } else {
    // User is not a visitor and not authenticated, return an error response
    res.status(403).json({ error: 'Unauthorized access' });
  }
};

module.exports = Visitor;
