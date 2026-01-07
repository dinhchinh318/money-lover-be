const cloudinary = require("../configs/cloudinary");
const streamifier = require("streamifier");

const uploadImageBuffer = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "money-lover",
        resource_type: "image",
        transformation: options.transformation || [{ quality: "auto" }, { fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

const deleteByPublicId = async (publicId) => {
  if (!publicId) throw new Error("Thiếu publicId");
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
};

module.exports = {
  uploadImageBuffer,
  deleteByPublicId,
};
