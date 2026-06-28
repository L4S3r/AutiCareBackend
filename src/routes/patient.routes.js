const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validate.middleware');
const { getPatients, createPatient, getPatient, updatePatient, getPatientSummary } = require('../controllers/patient.controller');

router.use(protect);
router.get('/',            getPatients);
router.post('/',           authorize('doctor', 'admin', 'parent'), validate(schemas.createPatientSchema), createPatient);
router.get('/:id',         getPatient);
router.put('/:id',         authorize('doctor', 'admin'),           validate(schemas.updatePatientSchema),  updatePatient);
router.get('/:id/summary', getPatientSummary);

module.exports = router;

