const multer = require("multer");

const uploadAvatar = multer({
  storage: multer.memoryStorage(), // 🔥 không ghi file
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files allowed"));
    }
    cb(null, true);
  },
});

module.exports = { uploadAvatar };
