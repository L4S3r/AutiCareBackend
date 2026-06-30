const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');
const { validate, schemas } = require('../middleware/validate.middleware');
const { getPatients, createPatient, getPatient, updatePatient, getPatientSummary, updateAvatar, uploadBirthCertificate, deletePatient } = require('../controllers/patient.controller');
const { upload, validateFileMagicBytes } = require('../middleware/file.middleware');

router.use(protect);
router.get('/',            getPatients);
router.post('/',           authorize('doctor', 'admin', 'parent'), validate(schemas.createPatientSchema), createPatient);
router.get('/:id',         getPatient);
router.put('/:id',         authorize('doctor', 'admin'),           validate(schemas.updatePatientSchema),  updatePatient);
router.get('/:id/summary', getPatientSummary);
router.delete('/:id',      authorize('parent', 'admin'),           deletePatient);

router.patch('/:id/avatar', authorize('parent', 'admin'), upload.single('avatar'), validateFileMagicBytes, updateAvatar);
router.post('/:id/birth-certificate', authorize('parent', 'admin'), upload.single('birthCertificate'), validateFileMagicBytes, uploadBirthCertificate);

module.exports = router;
