const mongoose = require('mongoose');
const User = require('./src/models/User.model');
const ChildProfile = require('./src/models/ChildProfile.model');
const BehaviorLog = require('./src/models/BehaviorLog.model');
const CareNote = require('./src/models/CareNote.model');
const GeneticReport = require('./src/models/GeneticReport.model');
const NutritionPlan = require('./src/models/NutritionPlan.model');
const GameScore = require('./src/models/GameScore.model');
const seeder = require('./src/config/seeder');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/auticare');
  console.log('Connected to DB');
  
  // Clear collections
  await User.deleteMany({});
  await ChildProfile.deleteMany({});
  await BehaviorLog.deleteMany({});
  await CareNote.deleteMany({});
  await GeneticReport.deleteMany({});
  await NutritionPlan.deleteMany({});
  await GameScore.deleteMany({});
  console.log('Cleared all collections.');

  // Run seeder
  await seeder();
  console.log('Seeded database successfully.');
  
  await mongoose.disconnect();
}

run().catch(console.error);
