const User = require('../model/User');
const bcrypt = require('bcryptjs');

async function ensureAdminAccount() {
  const adminEmail = 'admin@archersforum.com';
  const existing = await User.findOne({ email: adminEmail });

  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
    }
    return;
  }

  const hashedPassword = await bcrypt.hash('admin1234', 10);
  await User.create({
    name: 'Admin User',
    email: adminEmail,
    password: hashedPassword,
    role: 'admin',
  });
}

module.exports = {
  ensureAdminAccount,
};
