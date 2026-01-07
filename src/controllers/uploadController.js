const uploadService = require("../services/uploadService");

const uploadSingle = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: false, message: "Thiếu file (field name: image)" });
    }

    const result = await uploadService.uploadImageBuffer(req.file.buffer, {
      folder: "money-lover/uploads",
    });

    return res.status(200).json({
      status: true,
      message: "Upload thành công",
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err?.message || "Upload thất bại",
      error: err,
    });
  }
};

const deleteImage = async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId); // ✅ QUAN TRỌNG
    const result = await uploadService.deleteByPublicId(publicId);

    return res.status(200).json({
      status: true,
      message: "Xóa thành công",
      data: result,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err?.message || "Xóa thất bại",
    });
  }
};

module.exports = {
  uploadSingle,
  deleteImage,
};
