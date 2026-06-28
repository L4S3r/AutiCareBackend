/**
 * validate.middleware.js
 * ──────────────────────
 * Generic Joi schema validation middleware factory.
 * Usage: router.post('/route', validate(schema), controller)
 *
 * Rejects non-conforming bodies with 422 Unprocessable Entity.
 * Never lets malformed or extra fields reach a controller.
 */
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

  // Optional child bootstrap fields
  childName: Joi.string().trim().max(100).optional().allow('', null),
  childAge: Joi.number().integer().min(1).max(18).optional().allow(null),
  childGender: Joi.string().valid(...ALLOWED_GENDER).optional().allow(null),
  diagnosisLevel: Joi.string().valid(...ALLOWED_ASD).optional().allow(null),
  childUsername: Joi.string().trim().lowercase().max(50).optional().allow('', null),
  childPassword: Joi.string().min(6).max(128).optional().allow('', null),
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
  // Only non-parent callers may set parentId; validated separately in the controller
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
}).min(1); // At least one field must be present on an update

/**
 * POST /api/genetic/upload  (body fields alongside the multipart file)
 */
const uploadReportSchema = Joi.object({
  childId: Joi.string().hex().length(24).required(),
  notes: Joi.string().trim().max(2000).optional().allow(''),
  manualMarkers: Joi.alternatives()
    .try(Joi.array(), Joi.string())
    .optional(),
});

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * @param {Joi.Schema} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
const validate = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,  // collect all errors, not just the first
    stripUnknown: true,   // silently drop fields not in schema (mass-assignment kill-switch)
    convert: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    return res.status(422).json({ error: 'Validation failed.', details: messages });
  }

  // Replace req[source] with the sanitized, schema-validated value
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
  },
};
