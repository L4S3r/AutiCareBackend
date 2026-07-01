const Joi = require('joi');

// ─── Shared field rules ──────────────────────────────────────────────────────

const ALLOWED_ROLES = ['parent', 'doctor', 'therapist'];
const ALLOWED_GENDER = ['male', 'female', 'other'];
const ALLOWED_ASD = ['level1', 'level2', 'level3', 'not_specified'];

// ─── DTOs ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().min(8).max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/)
    .required()
    .messages({ 'string.pattern.base': 'Password must contain uppercase, lowercase, digit, and special character.' }),
  phone: Joi.string().trim().max(20).optional().allow('', null),
  role: Joi.string().valid(...ALLOWED_ROLES).default('parent'),
  clinic: Joi.string().trim().max(120).optional().allow('', null),

  // Professional credential parameters (validated optionally, sanitization active)
  nationalIdDoc: Joi.string().optional().allow('', null),
  nationalIdFront: Joi.string().optional().allow('', null),
  nationalIdBack: Joi.string().optional().allow('', null),
  certificates: Joi.array().items(Joi.string().allow('', null)).optional(),

  // Required child bootstrap fields for parent signups
  childName: Joi.string().trim().max(100).when('role', {
    is: 'parent',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null)
  }),
  childAge: Joi.number().integer().min(1).max(18).when('role', {
    is: 'parent',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null)
  }),
  childGender: Joi.string().valid(...ALLOWED_GENDER).when('role', {
    is: 'parent',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null)
  }),
  diagnosisLevel: Joi.string().valid(...ALLOWED_ASD).when('role', {
    is: 'parent',
    then: Joi.required(),
    otherwise: Joi.optional().allow(null)
  }),
  childUsername: Joi.string().trim().lowercase().max(50).when('role', {
    is: 'parent',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null)
  }),
  childPassword: Joi.string().min(6).max(128).when('role', {
    is: 'parent',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null)
  }),
});

/**
 * POST /api/auth/firebase-login
 */
const firebaseLoginSchema = Joi.object({
  idToken: Joi.string().min(10).required(),
  name: Joi.string().trim().max(100).optional().allow('', null),
  role: Joi.string().valid(...ALLOWED_ROLES, 'admin').default('parent'),
  clinic: Joi.string().trim().max(120).optional().allow('', null),

  childName: Joi.string().trim().max(100).optional().allow('', null),
  childAge: Joi.number().integer().min(1).max(18).optional().allow(null),
  childGender: Joi.string().valid(...ALLOWED_GENDER).optional().allow(null),
  diagnosisLevel: Joi.string().valid(...ALLOWED_ASD).optional().allow(null),
  childUsername: Joi.string().trim().lowercase().max(50).optional().allow('', null),
  childPassword: Joi.string().min(6).max(128).optional().allow('', null),
});

/**
 * POST /api/patients  (createPatient)
 */
const createPatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  dateOfBirth: Joi.date().iso().max('now').required(),
  gender: Joi.string().valid(...ALLOWED_GENDER).optional(),
  diagnosisDate: Joi.date().iso().optional(),
  asdLevel: Joi.string().valid(...ALLOWED_ASD).default('not_specified'),
  parentId: Joi.string().hex().length(24).optional(),
});

/**
 * PUT /api/patients/:id  (updatePatient)
 */
const updatePatientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  dateOfBirth: Joi.date().iso().max('now').optional(),
  gender: Joi.string().valid(...ALLOWED_GENDER).optional(),
  diagnosisDate: Joi.date().iso().optional(),
  asdLevel: Joi.string().valid(...ALLOWED_ASD).optional(),
  notes: Joi.string().trim().max(2000).optional().allow(''),
  allergies: Joi.array().items(Joi.string().trim().max(100)).max(50).optional(),
  currentMedications: Joi.array().items(Joi.string().trim().max(200)).max(50).optional(),
}).min(1);

/**
 * POST /api/genetic/upload  (body fields alongside the multipart file)
 */
const uploadReportSchema = Joi.object({
  childId: Joi.string().hex().length(24).required(),
  notes: Joi.string().trim().max(2000).optional().allow(''),
  laboratory: Joi.string().valid('Al-Borg', 'Alfa', 'GASC', 'Unknown').optional().default('Unknown'),
  manualMarkers: Joi.alternatives()
    .try(Joi.array(), Joi.string())
    .optional(),
});

const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().lowercase().trim().required(),
  phone: Joi.string().trim().max(20).optional().allow('', null),
  message: Joi.string().min(5).max(5000).required(),
});

// ─── Middleware factory ───────────────────────────────────────────────────────

const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(422).json({ error: 'Validation failed.', details: messages });
  }

  req[source] = value;
  next();
};

module.exports = {
  validate,
  schemas: {
    registerSchema,
    firebaseLoginSchema,
    createPatientSchema,
    updatePatientSchema,
    uploadReportSchema,
    contactSchema,
  },
};
