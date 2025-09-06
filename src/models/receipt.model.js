const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema({
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true
    },
    receiptNumber: {
        type: String,
        required: true,
        unique: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    issuedAt: {
        type: Date,
        default: Date.now
    },
}, { timestamps: true });

module.exports = mongoose.model('Receipt', receiptSchema);
