const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const NutritionPlan = require('../models/NutritionPlan.model');
const GeneticReport = require('../models/GeneticReport.model');
const GameScore = require('../models/GameScore.model');

// @route GET /api/patients
const getPatients = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { isActive: true };
    if (req.user.role === 'parent') query.parentId = req.user._id;
    if (req.user.role === 'doctor') query.assignedDoctor = req.user._id;
    if (req.user.role === 'therapist') query.assignedTherapists = req.user._id;

    const [patients, total] = await Promise.all([
      ChildProfile.find(query).populate('parentId', 'name email').populate('assignedDoctor', 'name').skip(skip).limit(limit).sort('-createdAt'),
      ChildProfile.countDocuments(query),
    ]);
    res.json({ success: true, data: patients, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

// @route POST /api/patients
// req.body is pre-sanitized by validate(createPatientSchema) on the route
const createPatient = async (req, res, next) => {
  try {
    const { name, dateOfBirth, gender, diagnosisDate, asdLevel } = req.body;

    // parentId: parents always own their own child record.
    // Doctors/admins must supply a valid parentId that has been validated by the Joi schema.
    const parentId = req.user.role === 'parent' ? req.user._id : req.body.parentId;
    if (!parentId) {
      return res.status(400).json({ error: 'parentId is required for non-parent roles.' });
    }

    const patient = await ChildProfile.create({
      name,
      dateOfBirth,
      gender,
      diagnosisDate,
      asdLevel,
      parentId,
    });
    res.status(201).json({ success: true, data: patient });
  } catch (err) { next(err); }
};

// @route GET /api/patients/:id
const getPatient = async (req, res, next) => {
  try {
    const patient = await ChildProfile.findById(req.params.id)
      .populate('parentId', 'name email phone')
      .populate('assignedDoctor', 'name email specialization')
      .populate('assignedTherapists', 'name email');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ success: true, data: patient });
  } catch (err) { next(err); }
};

// @route PUT /api/patients/:id
// req.body is pre-sanitized by validate(updatePatientSchema) on the route.
// Only the whitelisted fields below may ever reach the database.
const updatePatient = async (req, res, next) => {
  try {
    // ─── Assignment Authorization Gate ────────────────────────────────────────
    // Before touching the document, verify the requesting doctor is explicitly
    // assigned to this patient. Without this check any authenticated doctor
    // could mutate any child profile (IDOR vulnerability).
    if (req.user.role === 'doctor') {
      const existing = await ChildProfile.findById(req.params.id)
        .select('assignedDoctor assignedTherapists')
        .lean();

      if (!existing) return res.status(404).json({ error: 'Patient not found' });

      const doctorId   = req.user._id.toString();
      const isAssigned =
        // Primary clinician match
        (existing.assignedDoctor && existing.assignedDoctor.toString() === doctorId) ||
        // Care-team array membership (therapists array may also hold consultant doctors)
        (Array.isArray(existing.assignedTherapists) &&
          existing.assignedTherapists.some((t) => t.toString() === doctorId));

      if (!isAssigned) {
        return res.status(403).json({
          error: 'Access Denied: You are not explicitly assigned as the primary clinician for this case profile.',
        });
      }
    }

    const { name, dateOfBirth, gender, diagnosisDate, asdLevel, notes, allergies, currentMedications } = req.body;

    // Build the update payload from only the fields that were actually provided
    const update = {};
    if (name               !== undefined) update.name               = name;
    if (dateOfBirth        !== undefined) update.dateOfBirth        = dateOfBirth;
    if (gender             !== undefined) update.gender             = gender;
    if (diagnosisDate      !== undefined) update.diagnosisDate      = diagnosisDate;
    if (asdLevel           !== undefined) update.asdLevel           = asdLevel;
    if (notes              !== undefined) update.notes              = notes;
    if (allergies          !== undefined) update.allergies          = allergies;
    if (currentMedications !== undefined) update.currentMedications = currentMedications;

    const patient = await ChildProfile.findByIdAndUpdate(
      req.params.id,
      { $set: update },           // $set prevents wholesale document replacement
      { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json({ success: true, data: patient });
  } catch (err) { next(err); }
};

// @route GET /api/patients/:id/summary
const getPatientSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [patient, recentLogs, latestPlan, gameScores] = await Promise.all([
      ChildProfile.findById(id).populate('assignedDoctor', 'name').populate('parentId', 'name'),
      BehaviorLog.find({ childId: id }).sort('-date').limit(7),
      NutritionPlan.findOne({ childId: id, approved: true }).sort('-approvedAt'),
      GameScore.find({ childId: id }).sort('-createdAt').limit(10),
    ]);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const avgSleep = recentLogs.length ? recentLogs.reduce((s, l) => s + (l.sleepHours || 0), 0) / recentLogs.length : 0;
    const totalMeltdowns = recentLogs.reduce((s, l) => s + (l.meltdowns || 0), 0);

    res.json({ success: true, data: { patient, recentLogs, latestPlan, gameScores, stats: { avgSleep: avgSleep.toFixed(1), totalMeltdowns, logsCount: recentLogs.length } } });
  } catch (err) { next(err); }
};

module.exports = { getPatients, createPatient, getPatient, updatePatient, getPatientSummary };
