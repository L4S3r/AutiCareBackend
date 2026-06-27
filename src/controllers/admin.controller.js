const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const GeneticReport = require('../models/GeneticReport.model');
const NutritionPlan = require('../models/NutritionPlan.model');
const AuditLog = require('../models/AuditLog.model');

const getAdminStats = async (req, res, next) => {
    try {
        const [users, patients, reports, plans, logs] = await Promise.all([
            User.countDocuments({ isActive: true }),
            ChildProfile.countDocuments({ isActive: true }),
            GeneticReport.countDocuments(),
            NutritionPlan.countDocuments({ approved: true }),
            BehaviorLog.countDocuments(),
        ]);
        const roleBreakdown = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
        ]);
        res.json({
            success: true,
            data: { users, patients, reports, approvedPlans: plans, behaviorLogs: logs, roleBreakdown },
        });
    } catch (err) { next(err); }
};

const getAdminUsers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const filter = req.query.role ? { role: req.query.role } : {};
        const [users, total] = await Promise.all([
            User.find(filter).select('-password -refreshToken').skip(skip).limit(limit).sort('-createdAt'),
            User.countDocuments(filter),
        ]);
        res.json({
            success: true,
            data: users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) { next(err); }
};

const getAuditLogs = async (req, res, next) => {
    try {
        const logs = await AuditLog.find()
            .populate('userId', 'name role')
            .sort('-createdAt')
            .limit(100);
        res.json({ success: true, data: logs });
    } catch (err) { next(err); }
};

module.exports = { getAdminStats, getAdminUsers, getAuditLogs };