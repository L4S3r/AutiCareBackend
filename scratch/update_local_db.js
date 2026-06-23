const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User.model');
const ChildProfile = require('../src/models/ChildProfile.model');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auticare';
  await mongoose.connect(uri);
  console.log('Connected to DB');

  // 1. Find user with email ahmedyaso55@gmail.com
  let user = await User.findOne({ email: 'ahmedyaso55@gmail.com' });
  if (user) {
    user.role = 'parent';
    user.name = 'Ahmed Yasser';
    await user.save({ validateBeforeSave: false });
    console.log('Updated user ahmedyaso55@gmail.com to parent Ahmed Yasser');
  } else {
    user = await User.create({
      name: 'Ahmed Yasser',
      email: 'ahmedyaso55@gmail.com',
      password: 'password123',
      role: 'parent',
      isActive: true
    });
    console.log('Created parent user Ahmed Yasser with email ahmedyaso55@gmail.com');
  }

  // 2. Associate a child profile
  const child = await ChildProfile.findOne({ parentId: user._id });
  if (!child) {
    await ChildProfile.create({
      name: 'Mohamed',
      dateOfBirth: new Date(2020, 0, 1),
      gender: 'male',
      asdLevel: 'level2',
      parentId: user._id,
      isActive: true
    });
    console.log('Created child Mohamed for Ahmed Yasser');
  } else {
    console.log(`Child profile already exists for Ahmed Yasser: ${child.name}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
