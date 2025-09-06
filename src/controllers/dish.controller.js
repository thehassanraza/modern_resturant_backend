const DishModel = require('../models/dish.model');
const DishCategoryModel = require('../models/dish.category.model');

// Create a new dish
exports.createDish = async (req, res) => {
    const { name, description, price, category, images, isAvailable } = req.body;

    if (!name || !price || !category) {
        return res.status(400).json({ success: false, message: 'Name, price, and category are required' });
    }

    try {
        // Check if category exists and active
        const dishCategory = await DishCategoryModel.findById(category);
        if (!dishCategory || !dishCategory.isActive) {
            return res.status(400).json({ success: false, message: 'Invalid or inactive category' });
        }

        const newDish = await DishModel.create({
            name,
            description,
            price,
            category,
            images: images || [],
            isAvailable: isAvailable !== undefined ? isAvailable : true,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Dish created successfully',
            dish: newDish
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create dish', error: error.message });
    }
};

// Update a dish
exports.updateDish = async (req, res) => {
    const { name, description, price, category, images, isAvailable, isActive } = req.body;

    try {
        const dishId = req.params.id;
        const dish = await DishModel.findById(dishId);
        if (!dish) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }

        // Validate category if provided
        if (category) {
            const dishCategory = await DishCategoryModel.findById(category);
            if (!dishCategory || !dishCategory.isActive) {
                return res.status(400).json({ success: false, message: 'Invalid or inactive category' });
            }
            dish.category = category;
        }

        dish.name = name || dish.name;
        dish.description = description || dish.description;
        dish.price = price !== undefined ? price : dish.price;
        dish.images = images || dish.images;
        if (isAvailable !== undefined) dish.isAvailable = isAvailable;
        if (isActive !== undefined) dish.isActive = isActive;

        await dish.save();

        res.status(200).json({
            success: true,
            message: 'Dish updated successfully',
            dish
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update dish', error: error.message });
    }
};

// Soft delete a dish
exports.deleteDish = async (req, res) => {
    try {
        const dishId = req.params.id;
        const dish = await DishModel.findById(dishId);
        if (!dish) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }

        dish.isActive = false;
        await dish.save();

        res.status(200).json({ success: true, message: 'Dish deactivated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete dish', error: error.message });
    }
};

//Get all dishes with pagination, search, and filters
exports.getAllDishes = async (req, res) => {
    const { page = 1, limit = 10, search = '', category, isAvailable, isActive } = req.query;

    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (category) query.category = category;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (isActive !== undefined) query.isActive = isActive === 'true';

    try {
        const dishes = await DishModel.find(query)
            .populate('category', 'name')
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await DishModel.countDocuments(query);

        res.status(200).json({
            success: true,
            page: Number(page),
            limit: Number(limit),
            total,
            dishes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch dishes', error: error.message });
    }
};

// Get single dish by ID
exports.getDishById = async (req, res) => {
    try {
        const dishId = req.params.id;
        const dish = await DishModel.findById(dishId).populate('category', 'name');
        if (!dish) {
            return res.status(404).json({ success: false, message: 'Dish not found' });
        }

        res.status(200).json({ success: true, dish });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch dish', error: error.message });
    }
};
