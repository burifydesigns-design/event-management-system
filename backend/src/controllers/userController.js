const bcrypt = require('bcryptjs');
const User = require('../models/User');
const mongoose = require('mongoose');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

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
    const { page, limit, skip, error } = parsePagination(req.query, { defaultLimit: 20 });
    if (error) return res.status(400).json({ message: error });
    const { search, role } = req.query;
    const match = {};
    if (search) {
      match.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) match.role = role;
    const [result] = await User.aggregate([
      { $match: match },
      { $project: { password: 0 } },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'totalItems' }],
          data: [{ $skip: skip }, { $limit: limit }],
        },
      },
    ]);
    const totalItems = (result && result.metadata && result.metadata[0] && result.metadata[0].totalItems) || 0;
    const data = (result && result.data) || [];
    res.json({ data, pagination: buildPaginationMeta({ page, limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};
