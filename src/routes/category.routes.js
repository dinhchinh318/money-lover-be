const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/categoryController");
const { verifyToken } = require("../middlewares/authMiddleware");

router.post('/', verifyToken, categoryController.createCategoryAPI);
router.get('/', verifyToken, categoryController.getAllCategoriesAPI);
// Route đặc biệt phải đặt trước /:id
router.patch('/:id/default', verifyToken, categoryController.setDefaultCategoryAPI);
router.get('/:id', verifyToken, categoryController.getCategoryByIdAPI);
router.put('/:id', verifyToken, categoryController.updateCategoryAPI);
router.delete('/:id', verifyToken, categoryController.deleteCategoryAPI);

module.exports = router;