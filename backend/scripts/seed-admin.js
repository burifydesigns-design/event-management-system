require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'burify.designs@gmail.com'.toLowerCase().trim();
  const password = 'Admin@99';
  const name = 'Admin';

  const existing = await User.findOne({ email });

  if (existing) {
    existing.name = name;
    existing.role = 'admin';
    existing.isSuperAdmin = true;
    existing.status = 'active';
    existing.password = await bcrypt.hash(password, 10);
    await existing.save();
    console.log(`Updated existing user ${email} to super admin.`);
  } else {
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed, role: 'admin', isSuperAdmin: true, status: 'active' });
    console.log(`Created super admin user ${email}.`);
  }

  const user = await User.findOne({ email }).select('-password');
  console.log(JSON.stringify(user, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
