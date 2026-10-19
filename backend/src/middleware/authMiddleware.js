const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  let decoded;
  try {
    const token = header.split(' ')[1];
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const user = await User.findById(decoded.userId).select('_id name email role');
    if (!user) return res.status(401).json({ message: 'Invalid or expired token' });

    req.user = {
      ...decoded,
      userId: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authMiddleware;
