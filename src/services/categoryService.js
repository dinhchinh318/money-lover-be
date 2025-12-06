const category = require("../models/category");
const Category = require("../models/category");
const wallet = require("../models/wallet");

const createCategory = async (userId, categoryData) => {
  try {
    const exists = await Category.findOne({
      userId,
      name: categoryData.name.trim(),
      deleted: false,
    });

    if (exists){
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
  } catch(error){
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
  } catch(error){
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
    const category = await Category.find({ _id: categoryId, userId });

    if (!category){
      return {
        status: false,
        error: 1,
        message: "Category not found",
        data: null,
      };
    }

    return category;
  } catch(error){
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
    const category = await Category.findOneAndUpdate(
      { _id: categoryId, userId },
      data,
      { new: true }
    );

    if (!category){
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
      message: "Updated successfully",
      data: category.toObject(),
    };
  } catch(error){
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

    if (!category){
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
  } catch(error){
    return {
      status: false,
      error: -1,
      message: error.message,
      data: null,
    };
  }
}

module.exports = {
  createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory
}