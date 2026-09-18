const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Admin only: create a coordinator or organizer account
exports.createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!['coordinator', 'organizer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be coordinator or organizer' });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role,
      createdBy: req.user._id,
    });

    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    next(err);
  }
};
