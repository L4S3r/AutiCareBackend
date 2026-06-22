const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const CareNote = require('../models/CareNote.model');

router.use(protect);

// GET /api/notes/:childId - Get notes for a child
router.get('/:childId', async (req, res, next) => {
  try {
    const notes = await CareNote.find({ childId: req.params.childId }).sort({ createdAt: 1 });
    res.json({ success: true, data: notes });
  } catch (err) { next(err); }
});

// POST /api/notes - Create a care note
router.post('/', async (req, res, next) => {
  try {
    const { childId, content, category, approvedByDoctor, timestamp } = req.body;
    
    const authorId = req.user._id;
    const authorName = req.user.name;
    
    // Map DB user roles to UI actor roles
    let authorRole = 'Parent';
    if (req.user.role === 'doctor') authorRole = 'Doctor';
    else if (req.user.role === 'therapist') authorRole = 'Therapist';

    const note = await CareNote.create({
      childId,
      authorId,
      authorName,
      authorRole,
      content,
      category,
      approvedByDoctor: approvedByDoctor || (authorRole === 'Doctor'),
      timestamp: timestamp || new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    });

    res.status(201).json({ success: true, data: note });
  } catch (err) { next(err); }
});

// PUT /api/notes/:id/approve - Approve a note by doctor
router.put('/:id/approve', async (req, res, next) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only clinical staff can approve notes' });
    }

    const note = await CareNote.findByIdAndUpdate(
      req.params.id,
      { approvedByDoctor: true },
      { new: true }
    );
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    res.json({ success: true, data: note });
  } catch (err) { next(err); }
});

module.exports = router;
