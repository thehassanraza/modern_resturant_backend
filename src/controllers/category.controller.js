const DishCategoryModel = require('../models/dish.category.model');

// Create a new category
exports.createCategory = async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    try {
        // Check if category already exists
        const existingCategory = await DishCategoryModel.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({
                success: false,
                message: `${existingCategory.name} ${existingCategory.isActive ? 'already exists' : 'exists but is inactive'}`
            });
        }

        const newCategory = await DishCategoryModel.create({
            name,
            description,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            category: newCategory
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create category', error: error.message });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    const { name, description, isActive } = req.body;

    try {
        const categoryId = req.params.id;
        const category = await DishCategoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.name = name || category.name;
        category.description = description || category.description;
        if (isActive !== undefined) category.isActive = isActive;
        category.updatedAt = Date.now();

        await category.save();

        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            category
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
    }
};

// Soft delete category
exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await DishCategoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        category.isActive = false;
        await category.save();

        res.status(200).json({ success: true, message: 'Category deactivated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete category', error: error.message });
    }
};

// Get all categories with pagination, search, and filters
exports.getAllCategories = async (req, res) => {
    const { page = 1, limit = 10, search = '', isActive } = req.query;

    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (isActive !== undefined) query.isActive = isActive === 'true';

    try {
        const categories = await DishCategoryModel.find(query)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await DishCategoryModel.countDocuments(query);

        res.status(200).json({
            success: true,
            page: Number(page),
            limit: Number(limit),
            total,
            categories
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch categories', error: error.message });
    }
};

// Get single category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const categoryId = req.params.id;
        const category = await DishCategoryModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.status(200).json({ success: true, category });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch category', error: error.message });
    }
};
