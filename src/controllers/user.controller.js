const UserModel = require('../models/user.model');
const OtpModel = require('../models/otp.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { isValidEmail } = require('../utils/validiate.email');
const { isStrongPassword } = require('../utils/validiate.password');
const { generateOTP } = require('../utils/otp.generator')
const transporter = require('../utils/nodemailer');
const dotenv = require('dotenv');
dotenv.config();




// Get User profile
exports.getUserProfile = async (req, res) => {
    try {
        
        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully.",
            user: req.user
        });

    } catch (error) {
        console.error("Error in getUserProfile:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching user profile. Please try again later.",
            error: "SERVER_ERROR"
        });
    }
};

// Update User profile (excluding role, password, email)
exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        
        const { 
            name, 
            phoneNumber, 
            address = {} 
        } = req.body;

        const profileImage = req.file?.path || null;

        // Fetch user from DB
        const user = await UserModel.findById(userId);
        

        // Update fields if provided
        if (name) user.name = name.trim();
        if (phoneNumber) user.phoneNumber = phoneNumber.trim();
        if (profileImage) user.profileImage = profileImage;

        // Update address fields individually
        const addressFields = ['street', 'city', 'state', 'zip', 'country', 'landmark', 'note'];
        addressFields.forEach(field => {
            if (address[field] !== undefined) {
                user.address[field] = address[field].trim();
            }
        });

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                profileImage: user.profileImage,
                address: user.address
            }
        });

    } catch (error) {
        console.error("Error in updateUserProfile:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating profile. Please try again later.",
            error: "SERVER_ERROR"
        });
    }
};

//  add staff member
exports.addStaffMember = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const profileImage = req.file?.path || null;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and password are required."
            });
        }

        // Validate email
        const emailResult = await isValidEmail(email);
        if (!emailResult.isValid) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address.",
                errors: emailResult.errors,
                warnings: emailResult.warnings
            });
        }

        // Validate password
        const passwordResult = isStrongPassword(password, true);
        if (passwordResult !== true) {
            return res.status(400).json({
                success: false,
                message: "Password is not strong enough.",
                errors: Array.isArray(passwordResult) ? passwordResult : [passwordResult]
            });
        }

        //hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create staff member
        const staffMember = new UserModel({ 
            name, 
            email, 
            password: hashedPassword, 
            profileImage 
        });
        await staffMember.save();

        return res.status(201).json({
            success: true,
            message: "Staff member added successfully."
        });

    } catch (error) {
        console.error("Error in addStaffMember:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
}

// get all users
exports.getAllUsers = async (req, res) => {
    try {
        const currentUserId = req.user?._id;
        if (!currentUserId) {
            return res.status(401).json({ success: false, message: 'Unauthorized access.' });
        }

        const {
            search = '',
            role,           // optional role filter
            sortBy = 'createdAt',
            order = 'desc',
            page = 1,
            limit = 10
        } = req.query;

        const pageNumber = parseInt(page, 10);
        const pageSize = parseInt(limit, 10);

        const searchRegex = new RegExp(search, 'i');

        // Base match conditions
        const matchConditions = {
            _id: { $ne: mongoose.Types.ObjectId(currentUserId) },
            isSuperAdmin: false
        };

        // Aggregation pipeline
        const pipeline = [
            {
                $lookup: {
                    from: 'roles',
                    localField: 'role',
                    foreignField: '_id',
                    as: 'roleInfo'
                }
            },
            {
                $unwind: {
                    path: '$roleInfo',
                    preserveNullAndEmptyArrays: true
                }
            }
        ];

        // If role filter is provided, add it
        if (role) {
            matchConditions['roleInfo.name'] = role;
        }

        // Add search filter
        pipeline.push({
            $match: {
                ...matchConditions,
                $or: [
                    { name: searchRegex },
                    { email: searchRegex },
                    { phoneNumber: searchRegex },
                    { 'roleInfo.name': searchRegex },
                    { 'roleInfo.permissions': searchRegex }
                ]
            }
        });

        // Determine sort field
        const sortField = sortBy.toLowerCase() === 'role' ? 'roleInfo.name' : sortBy;

        pipeline.push({
            $sort: { [sortField]: order.toLowerCase() === 'asc' ? 1 : -1 }
        });

        // Pagination and total count
        pipeline.push({
            $facet: {
                data: [
                    { $skip: (pageNumber - 1) * pageSize },
                    { $limit: pageSize }
                ],
                totalCount: [{ $count: 'count' }]
            }
        });

        const result = await UserModel.aggregate(pipeline);

        const users = result[0]?.data || [];
        const totalCount = result[0]?.totalCount[0]?.count || 0;
        const totalPages = Math.ceil(totalCount / pageSize);

        return res.status(200).json({
            success: true,
            users,
            pagination: {
                totalCount,
                totalPages,
                currentPage: pageNumber,
                pageSize
            }
        });

    } catch (error) {
        console.error('Error in getAllUsers:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
};

//active inactive user toggle
exports.activeInactiveUserToggle = async (req, res) => {
    try {
        const userId  = req.params.userId;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required."
            });
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }
        user.isActive = !user.isActive;
        await user.save();
        return res.status(200).json({
            success: true,
            message: `user ${user.isActive ? 'activated' : 'deactivated'} successfully.`
        });
    } catch (error) {
        console.error("Error in activeInactiveUserToggle:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
}

