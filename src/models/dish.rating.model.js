const mongoose = require('mongoose');

const dishRatingSchema = new mongoose.Schema({
    dish: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dish',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 0,
        max: 5
    },
    comment: {
        type: String,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('DishRating', dishRatingSchema);
