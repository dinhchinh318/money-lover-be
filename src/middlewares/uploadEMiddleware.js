const multer = require("multer");

// lưu vào RAM (buffer) để đẩy thẳng lên Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ok = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
  if (!ok) return cb(new Error("Chỉ hỗ trợ file ảnh (png, jpg, jpeg, webp, gif)"), false);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
