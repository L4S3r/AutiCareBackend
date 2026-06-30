const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const NutritionPlan = require('../models/NutritionPlan.model');
const GeneticReport = require('../models/GeneticReport.model');
const GameScore = require('../models/GameScore.model');
const { uploadStream, deleteFile } = require('../services/storage.service');

// Helper: Verify user access to patient file (IDOR prevention)
const checkAccess = (patient, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'Child') {
    return patient._id.toString() === user._id.toString();
  }
  if (user.role === 'parent') {
    return patient.parentId.toString() === user._id.toString();
  }
  const isAssigned =
    (patient.assignedDoctor && patient.assignedDoctor.toString() === user._id.toString()) ||
    (Array.isArray(patient.assignedTherapists) &&
      patient.assignedTherapists.some((t) => t.toString() === user._id.toString()));
  return !!isAssigned;
};

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
    
    if (!checkAccess(patient, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    res.json({ success: true, data: patient });
  } catch (err) { next(err); }
};

// @route PUT /api/patients/:id
// req.body is pre-sanitized by validate(updatePatientSchema) on the route.
const updatePatient = async (req, res, next) => {
  try {
    const patient = await ChildProfile.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (!checkAccess(patient, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    const { name, dateOfBirth, gender, diagnosisDate, asdLevel, notes, allergies, currentMedications } = req.body;

    const update = {};
    if (name               !== undefined) update.name               = name;
    if (dateOfBirth        !== undefined) update.dateOfBirth        = dateOfBirth;
    if (gender             !== undefined) update.gender             = gender;
    if (diagnosisDate      !== undefined) update.diagnosisDate      = diagnosisDate;
    if (asdLevel           !== undefined) update.asdLevel           = asdLevel;
    if (notes              !== undefined) update.notes              = notes;
    if (allergies          !== undefined) update.allergies          = allergies;
    if (currentMedications !== undefined) update.currentMedications = currentMedications;

    const updatedPatient = await ChildProfile.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: updatedPatient });
  } catch (err) { next(err); }
};

// @route GET /api/patients/:id/summary
const getPatientSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const patient = await ChildProfile.findById(id).populate('assignedDoctor', 'name').populate('parentId', 'name');
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (!checkAccess(patient, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    const [recentLogs, latestPlan, gameScores] = await Promise.all([
      BehaviorLog.find({ childId: id }).sort('-date').limit(7),
      NutritionPlan.findOne({ childId: id, approved: true }).sort('-approvedAt'),
      GameScore.find({ childId: id }).sort('-createdAt').limit(10),
    ]);

    const avgSleep = recentLogs.length ? recentLogs.reduce((s, l) => s + (l.sleepHours || 0), 0) / recentLogs.length : 0;
    const totalMeltdowns = recentLogs.reduce((s, l) => s + (l.meltdowns || 0), 0);

    res.json({ success: true, data: { patient, recentLogs, latestPlan, gameScores, stats: { avgSleep: avgSleep.toFixed(1), totalMeltdowns, logsCount: recentLogs.length } } });
  } catch (err) { next(err); }
};

const updateAvatar = async (req, res, next) => {
  try {
    const patient = await ChildProfile.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (!checkAccess(patient, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    let avatarUrl = null;
    if (req.file) {
      const uploadRes = await uploadStream(req.file.buffer, {
        folder: 'auticare/avatars',
        resource_type: 'image',
      });
      avatarUrl = uploadRes.secure_url;
    } else if (req.body.clear === 'true' || req.body.clear === true) {
      avatarUrl = null;
    } else {
      return res.status(400).json({ error: 'No file uploaded or clear parameter specified.' });
    }

    patient.avatar = avatarUrl;
    await patient.save();

    res.json({
      success: true,
      data: patient,
      message: avatarUrl ? 'Patient avatar updated successfully.' : 'Patient avatar cleared successfully.'
    });
  } catch (err) { next(err); }
};

const uploadBirthCertificate = async (req, res, next) => {
  try {
    const patient = await ChildProfile.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (!checkAccess(patient, req.user)) {
      return res.status(403).json({ error: 'Access Denied: You do not have authorization for this patient profile.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a birth certificate file.' });
    }

    const uploadRes = await uploadStream(req.file.buffer, {
      folder: 'auticare/birth_certificates',
      resource_type: 'auto',
    });

    patient.birthCertificateUrl = uploadRes.secure_url;
    await patient.save();

    res.status(200).json({
      success: true,
      data: patient,
      message: 'Birth certificate uploaded successfully.'
    });
  } catch (err) { next(err); }
};

// @route DELETE /api/patients/:id
const deletePatient = async (req, res, next) => {
  try {
    const patient = await ChildProfile.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // IDOR validation (only parent and admin can delete profiles)
    if (req.user.role !== 'admin' && patient.parentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access Denied: Only the parent or admin can delete this profile.' });
    }

    // Delete Cloudinary assets (avatar, birthCertificate)
    if (patient.avatar) {
      try {
        await deleteFile(patient.avatar);
      } catch (e) {
        console.error('Failed to delete avatar from Cloudinary:', e.message);
      }
    }
    if (patient.birthCertificateUrl) {
      try {
        await deleteFile(patient.birthCertificateUrl);
      } catch (e) {
        console.error('Failed to delete birth certificate from Cloudinary:', e.message);
      }
    }

    // Delete all genetic reports and their files from Cloudinary
    const reports = await GeneticReport.find({ childId: patient._id });
    for (const r of reports) {
      if (r.reportFileUrl) {
        try {
          await deleteFile(r.reportFileUrl);
        } catch (e) {
          console.error('Failed to delete report file from Cloudinary:', e.message);
        }
      }
    }

    // Cascading delete related models
    await BehaviorLog.deleteMany({ childId: patient._id });
    await NutritionPlan.deleteMany({ childId: patient._id });
    await GeneticReport.deleteMany({ childId: patient._id });
    await GameScore.deleteMany({ childId: patient._id });

    // Delete ChildProfile document
    await patient.deleteOne();

    res.json({
      success: true,
      message: 'Patient profile and all associated data purged successfully.'
    });
  } catch (err) { next(err); }
};

module.exports = {
  getPatients,
  createPatient,
  getPatient,
  updatePatient,
  getPatientSummary,
  updateAvatar,
  uploadBirthCertificate,
  deletePatient
};
