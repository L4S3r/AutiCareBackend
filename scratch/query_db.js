const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/models/User.model');
const ChildProfile = require('../src/models/ChildProfile.model');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auticare';
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const children = await ChildProfile.find({});
  console.log('=== CHILD PROFILES ===');
  console.log(JSON.stringify(children, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
