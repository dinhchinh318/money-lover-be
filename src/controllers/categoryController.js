const { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory, setDefaultCategory } = require("../services/categoryService");

const createCategoryAPI = async (req, res) => {
  let category = await createCategory(req.user.id, req.body.data);
  if (category && category.status !== false) {
    return res.status(201).json({
      EC: 0,
      message: category.message || "Created successfully",
      data: category.data,
    });
  }
  return res.status(200).json({
    EC: category?.error || -1,
    message: category?.message || "Create category failed",
    data: null,
  })
}

const getAllCategoriesAPI = async (req, res) => {
  let categories = await getAllCategories(req.user.id);
  if (categories && categories.status !== false) {
    return res.status(200).json({
      EC: 0,
      data: categories.data || categories,
    });
  }
  return res.status(200).json({
    EC: categories?.error || -1,
    message: categories?.message || "Get categories failed",
    data: null,
  })
}

const getCategoryByIdAPI = async (req, res) => {
  let category = await getCategoryById(req.params.id, req.user.id);
  if (category && category.status !== false) {
    return res.status(200).json({
      EC: 0,
      data: category.data || category,
    });
  }
  return res.status(200).json({
    EC: category?.error || -1,
    message: category?.message || "Category not found",
    data: null,
  })
}

const updateCategoryAPI = async (req, res) => {
  let category = await updateCategory(req.params.id, req.user.id, req.body.data);
  if (category && category.status !== false) {
    return res.status(200).json({
      EC: 0,
      message: category.message || "Updated successfully",
      data: category.data,
    });
  }
  return res.status(200).json({
    EC: category?.error || -1,
    message: category?.message || "Update failed",
    data: null,
  })
}

const deleteCategoryAPI = async (req, res) => {
  let category = await deleteCategory(req.params.id, req.user.id);
  if (category && category.status !== false) {
    return res.status(200).json({
      EC: 0,
      message: category.message || "Deleted successfully",
      data: category.data,
    });
  }
  return res.status(200).json({
    EC: category?.error || -1,
    message: category?.message || "Delete failed",
    data: null,
  })
}

const setDefaultCategoryAPI = async (req, res) => {
  const result = await setDefaultCategory(req.params.id, req.user.id);
  if (result && result.status !== false) {
    return res.status(200).json({
      EC: 0,
      message: result.message || "Set default successfully",
      data: result.data,
    });
  }
  return res.status(200).json({
    EC: result?.error || -1,
    message: result?.message || "Set default failed",
    data: null,
  })
}

module.exports = {
  createCategoryAPI,
  getAllCategoriesAPI,
  getCategoryByIdAPI,
  updateCategoryAPI,
  deleteCategoryAPI,
  setDefaultCategoryAPI,
}