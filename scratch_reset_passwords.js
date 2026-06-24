require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User.model');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auticare';
  console.log('Connecting to database...');
  await mongoose.connect(uri);
  console.log('Connected successfully!');

  const emailsToReset = ['ahmedyaso55@gmail.com', '202302119@pua.edu.eg'];
  const newPassword = 'Password123!';

  for (const email of emailsToReset) {
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User ${email} not found in database.`);
      continue;
    }

    user.password = newPassword;
    // user.save() will trigger the pre-save hook to hash the password correctly
    await user.save({ validateBeforeSave: false });
    console.log(`Successfully reset password for ${email} in MongoDB to: ${newPassword}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
