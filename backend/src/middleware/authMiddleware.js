const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const token = header.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: 'Server configuration error' });
    }
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    if (!decoded || !decoded.userId || !decoded.role) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    // Ensure user still exists and not disabled (if field exists)
    const user = await User.findById(decoded.userId).select('role status');
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    if (user.status === 'suspended') {
      return res.status(401).json({ message: 'Account is suspended' });
    }
    // Trust DB role as source of truth to prevent tampering
    req.user = { userId: String(user._id), role: user.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
