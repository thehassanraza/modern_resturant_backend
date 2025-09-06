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


// Generate JWT token
const generateToken = (id) => { 
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};


// Register Super Admin
exports.registerAdmin = async (req, res) => {
    try {
        const { email, password, name } = req.body;

        // Basic validation
        if (!email || !password || !name) {
            return res.status(400).json({ 
                success: false,
                message: "Email, password, and name are required." 
            });
        }

        // Validate email
        const emailResult = await isValidEmail(email);
        if (!emailResult.isValid) {
            return res.status(400).json({
                message: "Please enter a valid email address.",
                errors: emailResult.errors,
                warnings: emailResult.warnings
            });
        }

        // Validate password
        const passwordResult = isStrongPassword(password, true); // assuming your function can return errors/warnings if second param is true
        if (passwordResult !== true) {
            return res.status(400).json({
                message: "Password is not strong enough.",
                errors: Array.isArray(passwordResult) ? passwordResult : [passwordResult]
            });
        }

        // Check if Super Admin already exists
        const existingAdmin = await UserModel.findOne({ isSuperAdmin: true });
        if (existingAdmin) {
            return res.status(400).json({ message: "Super Admin already exists." });
        }

        // Hash password and create admin
        const hashedPassword = await bcrypt.hash(password, 10);
        const newAdmin = new UserModel({ email, password: hashedPassword, name, isSuperAdmin: true });
        await newAdmin.save();

        return res.status(201).json({
            success: true,
            message: "Super Admin registered successfully."
        });

    } catch (error) {
        console.error("Error in registerAdmin:", error);
        return res.status(500).json({
            message: "Something went wrong. Please try again later.",
            error: error.message
        });
    }
};





// Login User
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: "Email and password are required." 
            });
        }

        // Find user by email
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid email or password." 
            });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // Generate token with userId
        const token = generateToken(user._id);

        return res.status(200).json({
            success: true,
            userId: user._id,
            token
        });

    } catch (error) {
        console.error("Error in loginUser:", error);
        return res.status(500).json({
            message: "Something went wrong. Please try again later.",
            error: error.message
        });
    }
};

// request password reset
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email."
            });
        }

        // Validate email
        const emailValidation = await isValidEmail(email);
        if (!emailValidation.isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address.",
                errors: emailValidation.errors
            });
        }

        // Find user
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "No user account found with this email."
            });
        }

        // Generate OTP
        const otp = generateOTP(6); // 6 character alphanumeric OTP

        // Save OTP and expiry
        const newOtp = new OtpModel({ 
            email, 
            otp 
        });

        await newOtp.save();

        // Load HTML template
        const templatePath = path.join(__dirname, '../templates/passwordResetOtp.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf8');

        // Replace placeholders
        emailTemplate = emailTemplate
            .replace(/{{userName}}/g, user.name)
            .replace(/{{otpCode}}/g, otp)
            .replace(/{{expiryTime}}/g, '10');

        // Send email
        await sendEmail({
            to: email,
            subject: '🔐 Password Reset OTP - Restaurant Management System',
            html: emailTemplate
        });

        return res.status(200).json({
            success: true,
            message: "Password reset OTP has been sent to your email."
        });

    } catch (error) {
        console.error("Error in requestPasswordReset:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
};

// verify OTP
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        // Find OTP record and ensure it's not used
        const otpRecord = await OtpModel.findOne({ 
            email, 
            otp, 
            isUsed: false 
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid or already used OTP. Please request a new one."
            });
        }

        // Check expiry (10 minutes)
        const now = new Date();
        const otpCreatedAt = otpRecord.createdAt;
        if ((now - otpCreatedAt) / 1000 / 60 > 10) {
            return res.status(400).json({
                success: false,
                message: "OTP expired. Please request a new one."
            });
        }


        // Mark OTP as used
        otpRecord.isUsed = true;
        await otpRecord.save();

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully."
        });

    } catch (error) {
        console.error("Error in verifyOtp:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
};

// reset user password with OTP
exports.resetUserPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ 
                success: false,
                message: "Email, OTP, and new password are required." 
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

        // Validate password strength
        const passwordResult = isStrongPassword(newPassword, true);
        if (passwordResult !== true) {
            return res.status(400).json({
                success: false,
                message: "Password is not strong enough.",
                errors: Array.isArray(passwordResult) ? passwordResult : [passwordResult]
            });
        }

        // Find OTP record (already verified, so isUsed = true)
        const otpRecord = await OtpModel.findOne({ email, otp, isUsed: true });
        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "OTP not verified yet or invalid. Please verify OTP first."
            });
        }

        // Find user
        const user = await UserModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found with this email." 
            });
        }

        // Hash new password and save
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({ 
            success: true,
            message: "Password has been reset successfully." 
        });

    } catch (err) {
        console.error("Error in resetPassword:", err);
        return res.status(500).json({ 
            success: false,
            message: "Server error. Please try again later." 
        });
    }
};  

// request customer account 
exports.requestCustomerAccount = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
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


        // Find user
        const user = await UserModel.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email."
            });
        }

        // Generate OTP
        const otp = generateOTP(6); // 6 character alphanumeric OTP

        // Save OTP and expiry
        const newOtp = new OtpModel({ 
            email, 
            otp 
        });
        await newOtp.save();

        // Load HTML template
        const templatePath = path.join(__dirname, '../templates/customerAccountRequest.html');
        let emailTemplate = fs.readFileSync(templatePath, 'utf8');

        // Replace placeholders
        emailTemplate = emailTemplate
            .replace(/{{email}}/g, email)
            .replace(/{{otpCode}}/g, otp)
            .replace(/{{expiryTime}}/g, '10');

        
            //email payload
            const emailPayload = {
                to: email,
                subject: '🔐 Customer Account Request - Restaurant Management System',
                html: emailTemplate
            };
            
            //send email
            const emailsend = await transporter.sendMail(emailPayload);
            console.log(emailsend);
            if (emailsend.error) {
                return res.status(500).json({
                    success: false,
                    message: "Failed to send email."
                });
            }
            return res.status(200).json({
                success: true,
                message: "Customer account request has been sent to your email."
            });

    } catch (error) {
        console.error("Error in requestCustomerAccount:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
};

// register customer
exports.registerCustomer = async (req, res) => {
    try {
        const { email, otp, name, password } = req.body;

        if (!email || !otp || !name || !password) {
            return res.status(400).json({
                success: false,
                message: "Email, OTP, name, and password are required."
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


        // Find OTP record and see if it is not used
        const otpRecord = await OtpModel.findOne({ email, otp, isUsed: true });
        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "invalid or unverified OTP. Please request a new one."
            });
        }

        // Find user
        const user = await UserModel.findOne({ email });
        if (user) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email."
            });
        }

        // find role named customer
        const customerRole = await RoleModel.findOne({ name: 'customer' });
        if (!customerRole) {
            return res.status(400).json({
                success: false,
                message: "Customer role not found."
            });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new UserModel({ email, password: hashedPassword, name, isCustomer: true, role: customerRole._id });
        await newUser.save();

        // delete otpRecord
        await OtpModel.findOneAndDelete({ email, otp, isUsed: true });




        return res.status(200).json({
            success: true,
            message: "Customer registered successfully."
        });

    } catch (error) {
        console.error("Error in registerCustomer:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
};

//change password
exports.changePassword = async (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized access."
            });
        }

        if (!email || !currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email, current password, and new password are required."
            });
        }

        // find user with userId
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // check if current password is correct
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect."
            });
        }

        // hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password changed successfully."
        });

    } catch (error) {
         console.error("Error in changeCurrentPassword:", error);
        return res.status(500).json({
            success: false,
            message: "Server error. Please try again later."
        });
    }
};