const Category = require("../models/category");
const defaultCategories = require("../data/defaultCategories");

const createCategory = async (userId, categoryData) => {
  try {
    const exists = await Category.findOne({
      userId,
      name: categoryData.name.trim(),
      deleted: false,
    });

    if (exists) {
      return {
        status: false,
        error: 1,
        message: "Category name already exists. Please try another name.",
        data: null,
      };
    }

    const category = await Category.create({
      userId,
      ...categoryData,
    });

    return {
      status: true,
      error: 0,
      message: "Created successfully",
      data: category.toObject(),
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const getAllCategories = async (userId) => {
  try {
    const categories = await Category.find({ userId }).sort({ createdAt: 1 });

    return {
      status: true,
      error: 0,
      data: categories.map(c => c.toObject()),
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const getCategoryById = async (categoryId, userId) => {
  try {
    const category = await Category.findOne({ _id: categoryId, userId });

    if (!category) {
      return {
        status: false,
        error: 1,
        message: "Category not found",
        data: null,
      };
    }

    return {
      status: true,
      error: 0,
      message: "Get category successfully",
      data: category.toObject(),
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const updateCategory = async (categoryId, userId, data) => {
  try {
    const category = await Category.findOne({ _id: categoryId, userId });

    if (!category) {
      return {
        status: false,
        error: 1,
        message: "Category not found",
        data: null,
      };
    }

    // Update category
    Object.assign(category, data);
    await category.save();

    return {
      status: true,
      error: 0,
      message: "Updated successfully",
      data: category.toObject(),
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const deleteCategory = async (categoryId, userId) => {
  try {
    const category = await Category.findOne({ _id: categoryId, userId });

    if (!category) {
      return {
        status: false,
        error: 1,
        message: "Category not found",
        data: null,
      };
    }

    await category.delete();
    return {
      status: true,
      error: 0,
      message: "Deleted successfully",
      data: null,
    };
  } catch (error) {
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

const seedDefaultCategoriesForUser = async (userId) => {
  const docs = defaultCategories.map((c) => ({
    ...c,
    userId,
  }));

  await Category.insertMany(docs);
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  seedDefaultCategoriesForUser,
}