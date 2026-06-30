const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');
const BehaviorLog = require('../models/BehaviorLog.model');
const GeneticReport = require('../models/GeneticReport.model');
const NutritionPlan = require('../models/NutritionPlan.model');
const AuditLog = require('../models/AuditLog.model');
const bcrypt = require('bcryptjs');

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
        const requestedRole = req.query.role ? req.query.role.toLowerCase() : 'all';

        let unifiedUsers = [];
        let total = 0;

        if (requestedRole === 'child') {
            const [children, totalCount] = await Promise.all([
                ChildProfile.find().skip(skip).limit(limit).sort('-createdAt'),
                ChildProfile.countDocuments()
            ]);
            unifiedUsers = children.map(c => ({
                _id: c._id,
                avatar: c.avatar || null,
                name: c.name,
                email: null,
                username: c.username || null,
                role: 'child',
                isActive: c.isActive,
                isVerified: true,
                createdAt: c.createdAt
            }));
            total = totalCount;
        } else if (['parent', 'doctor', 'therapist', 'admin'].includes(requestedRole)) {
            const [users, totalCount] = await Promise.all([
                User.find({ role: requestedRole }).select('-password -refreshToken').skip(skip).limit(limit).sort('-createdAt'),
                User.countDocuments({ role: requestedRole })
            ]);
            unifiedUsers = users.map(u => ({
                _id: u._id,
                avatar: u.avatar || null,
                name: u.name,
                email: u.email,
                username: null,
                role: u.role,
                isActive: u.isActive,
                isVerified: u.isVerified,
                nationalIdFront: u.nationalIdFront || null,
                nationalIdBack: u.nationalIdBack || null,
                certificates: u.certificates || [],
                createdAt: u.createdAt
            }));
            total = totalCount;
        } else {
            const [users, children, totalUsers, totalChildren] = await Promise.all([
                User.find().select('-password -refreshToken').sort('-createdAt').limit(skip + limit),
                ChildProfile.find().sort('-createdAt').limit(skip + limit),
                User.countDocuments(),
                ChildProfile.countDocuments()
            ]);

            const mappedUsers = users.map(u => ({
                _id: u._id,
                avatar: u.avatar || null,
                name: u.name,
                email: u.email,
                username: null,
                role: u.role,
                isActive: u.isActive,
                isVerified: u.isVerified,
                nationalIdFront: u.nationalIdFront || null,
                nationalIdBack: u.nationalIdBack || null,
                certificates: u.certificates || [],
                createdAt: u.createdAt
            }));

            const mappedChildren = children.map(c => ({
                _id: c._id,
                avatar: c.avatar || null,
                name: c.name,
                email: null,
                username: c.username || null,
                role: 'child',
                isActive: c.isActive,
                isVerified: true,
                createdAt: c.createdAt
            }));

            const merged = [...mappedUsers, ...mappedChildren]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            unifiedUsers = merged.slice(skip, skip + limit);
            total = totalUsers + totalChildren;
        }

        res.json({
            success: true,
            data: unifiedUsers,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
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

const changeUserPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        let user = await User.findById(req.params.id);
        if (user) {
            user.password = hashedPassword;
            await user.save();
            return res.json({ success: true, message: 'Password updated successfully' });
        }

        let child = await ChildProfile.findById(req.params.id);
        if (child) {
            child.password = hashedPassword;
            await child.save();
            return res.json({ success: true, message: 'Password updated successfully' });
        }

        return res.status(404).json({ error: 'User or Child not found' });
    } catch (err) { next(err); }
};

const verifyBypass = async (req, res, next) => {
    try {
        let user = await User.findById(req.params.id);
        if (user) {
            user.isVerified = true;
            user.isActive = true;
            await user.save();
            return res.json({ success: true, data: user });
        }

        let child = await ChildProfile.findById(req.params.id);
        if (child) {
            child.isActive = true;
            await child.save();
            return res.json({ success: true, data: child });
        }

        return res.status(404).json({ error: 'User or Child not found' });
    } catch (err) { next(err); }
};

const toggleUserStatus = async (req, res, next) => {
    try {
        const { isActive } = req.body;
        let user = await User.findById(req.params.id);
        if (user) {
            user.isActive = isActive;
            await user.save();
            return res.json({ success: true, data: user });
        }

        let child = await ChildProfile.findById(req.params.id);
        if (child) {
            child.isActive = isActive;
            await child.save();
            return res.json({ success: true, data: child });
        }

        return res.status(404).json({ error: 'User or Child not found' });
    } catch (err) { next(err); }
};

const getUnverifiedPractitioners = async (req, res, next) => {
    try {
        const practitioners = await User.find({
            role: { $in: ['doctor', 'therapist'] },
            isVerified: false
        }).select('name email role avatar nationalIdFront nationalIdBack certificates isActive isVerified');
        
        res.json({
            success: true,
            data: practitioners
        });
    } catch (err) { next(err); }
};

module.exports = {
    getAdminStats,
    getAdminUsers,
    getAuditLogs,
    changeUserPassword,
    verifyBypass,
    toggleUserStatus,
    getUnverifiedPractitioners
};
