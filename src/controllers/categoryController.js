const { createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory } = require("../services/categoryService");

const createCategoryAPI = async (req, res) => {
  let category = await createCategory(req.user.id, req.body.data);
  if (category){
    return res.status(201).json({
      EC: 0,
      data: category,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

const getAllCategoriesAPI = async (req, res) => {
  let categories = await getAllCategories(req.user.id);
  if (categories){
    return res.status(201).json({
      EC: 0,
      data: categories,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

const getCategoryByIdAPI = async (req, res) => {
  let category = await getCategoryById(req.body.categoryId, req.user.id);
  if (category){
    return res.status(201).json({
      EC: 0,
      data: category,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

const updateCategoryAPI = async (req, res) => {
  let category = await updateCategory(req.body.categoryId, req.user.id, req.body.data);
  if (category){
    return res.status(201).json({
      EC: 0,
      data: category,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

const deleteCategoryAPI = async (req, res) => {
  let category = await deleteCategory(req.body.categoryId, req.user.id);
  if (category){
    return res.status(201).json({
      EC: 0,
      data: category,
    });
  }
  return res.status(200).json({
    EC: -1,
    data: null,
  })
}

module.exports = {
  createCategoryAPI, getAllCategoriesAPI, getCategoryByIdAPI, updateCategoryAPI, deleteCategoryAPI
}