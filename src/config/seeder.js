const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const CareNote = require('../models/CareNote.model');
const GeneticReport = require('../models/GeneticReport.model');
const NutritionPlan = require('../models/NutritionPlan.model');

const seedData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('🌱 Database already seeded. Skipping seeder.');
      return;
    }

    console.log('🌱 Database is empty. Seeding initial development data...');

    // 1. Create Users (Doctor, Parent)
    const doctor = await User.create({
      name: 'Dr. Karim Al-Saeed',
      email: 'dr.saeed@auticare.org',
      password: 'auticare123',
      role: 'doctor',
      phone: '+201012345678',
      clinic: 'Hope Autism Clinic',
      specialization: 'CARDIOLOGIST / MD',
      isActive: true
    });

    const parent = await User.create({
      name: 'Youssef Al-Farsi',
      email: 'youssef@auticare.org',
      password: 'auticare123',
      role: 'parent',
      phone: '+201087654321',
      isActive: true
    });

    // 2. Create Patient Profile
    const child = await ChildProfile.create({
      name: 'Sami Al-Farsi',
      dateOfBirth: new Date(2018, 5, 22), // 8 years old
      gender: 'male',
      diagnosisDate: new Date(2021, 8, 15),
      asdLevel: 'level2',
      parentId: parent._id,
      assignedDoctor: doctor._id,
      isActive: true
    });

    // 3. Create Genetic Report
    const report = await GeneticReport.create({
      childId: child._id,
      uploadedBy: doctor._id,
      isProcessed: true,
      ocrStatus: 'completed',
      notes: 'Initial saliva collection DNA screening report.',
      parsedMarkers: [
        { marker: 'MTHFR', result: 'homozygous', value: 'C677T/A1298C', notes: 'Severe methylation downregulation' },
        { marker: 'VDR', result: 'homozygous', value: 'ff', notes: 'Reduced Vitamin D binding capacity' },
        { marker: 'HLA-DQ2', result: 'positive', value: 'HLA-DQ2 positive', notes: 'High gluten sensitivity risk' }
      ]
    });

    // 4. Create Nutrition Plan
    const plan = await NutritionPlan.create({
      childId: child._id,
      geneticReportId: report._id,
      approved: true,
      approvedBy: doctor._id,
      approvedAt: new Date(),
      status: 'approved',
      aiRecommendation: {
        supplements: [
          { name: 'L-Methylfolate (as Metafolin®)', dosage: '400 mcg', frequency: 'daily morning', notes: 'Bypasses MTHFR methylation block' },
          { name: 'Liquid Vitamin D3 with K2 drops', dosage: '2000 IU', frequency: 'daily with breakfast', notes: 'Compensates for sluggish ff VDR receptor expression' },
          { name: 'Coenzyme Q10 and Probiotics', dosage: '1 capsule', frequency: 'daily night', notes: 'Secures intestinal barrier integrity' }
        ],
        nutritionPlan: 'Strict GFCF diet focusing on organic whole proteins, eliminating preservatives and food dyes.',
        foodRestrictions: ['Refined Wheat Flour, Barley, Rye (Gluten group)', 'Whole Cow Milk, Casein powders', 'Processed sugars, synthetic dyes (Red 40, Yellow 5)'],
        mealSuggestions: [
          { mealType: 'Breakfast', suggestions: ['Coconut Chia Pudding with Raspberries', 'Grain-Free Banana Pancakes'] },
          { mealType: 'Lunch', suggestions: ['Grilled Chicken Salad with Sprouted Greens', 'Turkey Lettuce Wraps with Avocado'] },
          { mealType: 'Dinner', suggestions: ['Wild Salmon over Cauliflower Mash', 'Organic Beef Bone Broth with Bok Choy'] }
        ],
        lifestyleGuidance: ['Incorporate physical play outdoor under sunlight to assist with natural vitamin activation.', 'Provide a quiet visual decompression room 30 min before sleep.'],
        reasoning: 'Genotype profiling indicates C677T/A1298C mutation, limiting methylation, and celiac risk (HLA-DQ2+). Supplying bypass vitamins reduces neuro-gut inflammation and meltdown risk.',
        markersAnalyzed: ['MTHFR', 'VDR', 'HLA-DQ2']
      }
    });

    // 5. Create Behavior Logs (Rolling 7-day logs)
    const logsData = [
      { date: '2026-06-15', mood: 'happy', sleepHours: 9, meltdownSeverity: 'none', meltdowns: 0, medication: [{ name: 'Metafolin', taken: true }], notes: 'Sami was focused, energetic, loved the cognitive memory game. Normal sensory responses.', aiRiskScore: 12 },
      { date: '2026-06-16', mood: 'happy', sleepHours: 8.5, meltdownSeverity: 'none', meltdowns: 0, medication: [{ name: 'Metafolin', taken: true }], notes: 'Stayed calm during grocery shopping. Gluten-free meal tolerated perfectly.', aiRiskScore: 18 },
      { date: '2026-06-17', mood: 'neutral', sleepHours: 7, meltdownSeverity: 'mild', meltdowns: 1, medication: [{ name: 'Metafolin', taken: true }], notes: 'Bit of restlessness around sunset. Agitated due to emergency truck sirens outside.', aiRiskScore: 45 },
      { date: '2026-06-18', mood: 'anxious', sleepHours: 6, meltdownSeverity: 'moderate', meltdowns: 2, medication: [{ name: 'Metafolin', taken: false }], notes: 'Refused morning supplement. Sleep disrupted. 20-minute verbal meltdown at school transition.', aiRiskScore: 78 },
      { date: '2026-06-19', mood: 'happy', sleepHours: 9.5, meltdownSeverity: 'none', meltdowns: 0, medication: [{ name: 'Metafolin', taken: true }], notes: 'Excellent rest, Metafolin dose given early. Highly compliant in speech therapy session.', aiRiskScore: 10 },
      { date: '2026-06-20', mood: 'happy', sleepHours: 8, meltdownSeverity: 'none', meltdowns: 0, medication: [{ name: 'Metafolin', taken: true }], notes: 'Happy mood all afternoon. Played shape matching game with sister.', aiRiskScore: 15 },
      { date: '2026-06-21', mood: 'neutral', sleepHours: 7.5, meltdownSeverity: 'mild', meltdowns: 1, medication: [{ name: 'Metafolin', taken: true }], notes: 'Mild stimming in evening, calm down protocol worked quickly after 5 minutes.', aiRiskScore: 28 }
    ];

    for (const log of logsData) {
      await BehaviorLog.create({
        childId: child._id,
        loggedBy: parent._id,
        date: new Date(log.date),
        mood: log.mood === 'happy' ? 'happy' : log.mood === 'neutral' ? 'neutral' : 'anxious',
        sleepHours: log.sleepHours,
        meltdownSeverity: log.meltdownSeverity,
        meltdowns: log.meltdowns,
        medication: log.medication,
        notes: log.notes,
        aiRiskScore: log.aiRiskScore
      });
    }

    // 6. Create Care Notes
    await CareNote.create({
      childId: child._id,
      authorId: doctor._id,
      authorName: doctor.name,
      authorRole: 'Doctor',
      content: 'Analyzed DNA report. Note severe downregulation in MTHFR and HLA-DQ2 positive status. Initiating methylation protocol with 400mcg methylfolate. Check-up appointment set in 2 weeks.',
      timestamp: '2026-06-21 09:30',
      category: 'Medical',
      approvedByDoctor: true
    });

    await CareNote.create({
      childId: child._id,
      authorId: doctor._id,
      authorName: 'Amina El-Gamil',
      authorRole: 'Therapist',
      content: 'Conducted ABA therapy focusing on eye contact and social turn-taking. Played two cognitive emotion boards. Sami responded brilliantly, accuracy scores improved to 85% compared to yesterday.',
      timestamp: '2026-06-21 11:45',
      category: 'Therapy',
      approvedByDoctor: false
    });

    await CareNote.create({
      childId: child._id,
      authorId: parent._id,
      authorName: parent.name,
      authorRole: 'Parent',
      content: 'Followed GFCF dinner exactly. Sami slept better last night (8 hours straight). No daytime meltdowns recorded. Supplements administered successfully with coconut water proxy.',
      timestamp: '2026-06-21 19:15',
      category: 'Dietary',
      approvedByDoctor: false
    });

    console.log('🌱 Data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Data seeding error:', error.message);
  }
};

module.exports = seedData;
