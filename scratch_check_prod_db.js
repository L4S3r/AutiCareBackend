require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User.model');
const ChildProfile = require('./src/models/ChildProfile.model');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auticare';
  console.log('Connecting to:', uri.replace(/:([^@]+)@/, ':****@'));
  await mongoose.connect(uri);
  console.log('Connected successfully!');
  
  const users = await User.find({}).sort({ createdAt: -1 }).limit(10);
  console.log('Latest 10 users in database:');
  users.forEach(u => {
    console.log(`- Name: ${u.name}, Email: ${u.email}, Role: ${u.role}, CreatedAt: ${u.createdAt}`);
  });
  
  const children = await ChildProfile.find({}).sort({ createdAt: -1 }).limit(10);
  console.log('Latest 10 children in database:');
  children.forEach(c => {
    console.log(`- Name: ${c.name}, ParentId: ${c.parentId}, CreatedAt: ${c.createdAt}`);
  });
  
  await mongoose.disconnect();
}

run().catch(console.error);
