const mongoose = require('mongoose');
const User = require('./src/models/User.model');
const ChildProfile = require('./src/models/ChildProfile.model');
const seeder = require('./src/config/seeder');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/auticare');
  console.log('Connected to DB');
  const users = await User.find({}, '+password');
  console.log('Users in database:', users.map(u => ({ name: u.name, email: u.email, role: u.role })));
  
  const children = await ChildProfile.find({});
  console.log('Children in database:', children.map(c => ({ name: c.name, parentId: c.parentId })));
  
  await mongoose.disconnect();
}

run().catch(console.error);
