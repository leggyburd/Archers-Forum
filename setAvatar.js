// Script to update a user's avatar in the database
const mongoose = require('mongoose');
const User = require('./model/User');

const MONGO_URI = 'mongodb://localhost:27017/archers-forum'; // Adjust if needed

const email = process.argv[2];
const avatarUrl = process.argv[3];

if (!email || !avatarUrl) {
  console.error('Usage: node setAvatar.js <user_email> <avatar_url>');
  process.exit(1);
}

async function updateAvatar() {
  await mongoose.connect(MONGO_URI);
  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { avatar: avatarUrl },
    { new: true }
  );
  if (!user) {
    console.error('User not found.');
  } else {
    console.log('Updated user:', user.email, '->', user.avatar);
  }
  await mongoose.disconnect();
}

updateAvatar();
