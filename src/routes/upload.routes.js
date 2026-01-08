const express = require("express");
const router = express.Router();

const upload = require("../middlewares/uploadEMiddleware");
const uploadController = require("../controllers/uploadController");

// POST /v1/api/upload/image  (form-data: image=<file>)
router.post("/image", upload.single("image"), uploadController.uploadSingle);

// DELETE /v1/api/upload/image/:publicId
router.delete("/image/:publicId", uploadController.deleteImage);


module.exports = router;
