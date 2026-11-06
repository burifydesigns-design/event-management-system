const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

exports.createStaffUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!['coordinator', 'organizer'].includes(role)) {
      return res.status(400).json({ message: 'Role must be coordinator or organizer' });
    }
    const existing = await User.findOne({ filter: { email } });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role,
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

    const totalItems = await User.countDocuments(match);
    const { rows: data } = await User.find({
      filter: match,
      sort: { createdAt: -1, _id: -1 },
      skip,
      limit,
    });
    for (const u of data) {
      delete u.password;
    }
    res.json({ data, pagination: buildPaginationMeta({ page, limit, totalItems }) });
  } catch (err) {
    next(err);
  }
};
