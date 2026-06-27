// src/controllers/admin.controller.js

const User = require('../models/User.model');
const ChildProfile = require('../models/ChildProfile.model');

const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find().select('-password -refreshToken');
        res.json({ success: true, count: users.length, data: users });
    } catch (err) { next(err); }
};

const deleteUser = async (req, res, next) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
    try {
        const userCount = await User.countDocuments();
        const childCount = await ChildProfile.countDocuments();
        res.json({ success: true, data: { userCount, childCount } });
    } catch (err) { next(err); }
};

module.exports = { getAllUsers, deleteUser, getStats };