const Profile = require("../models/profile");
const cloudinary = require("../configs/cloudinary");

const DEFAULT_PROFILE = {
  displayName: "",
  bio: "",
  avatarUrl: "",
  phone: "",
  address: "",
  dateOfBirth: null,
  gender: "unknown",
  occupation: "",
  hasCompletedOnboarding: false,
  favoriteCategories: [],
};

const getMyProfile = async (userId) => {
  try {
    let doc = await Profile.findOne({ userId }).populate("favoriteCategories");

    if (!doc) {
      doc = await Profile.create({ userId, ...DEFAULT_PROFILE });
      doc = await Profile.findOne({ userId }).populate("favoriteCategories");
    }

    return { status: true, error: 0, message: "OK", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const upsertMyProfile = async (userId, payload) => {
  try {
    const doc = await Profile.findOneAndUpdate(
      { userId },
      {
        $set: payload,
        $setOnInsert: { userId }, // ✅ chỉ set field không trùng
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate("favoriteCategories");

    return { status: true, error: 0, message: "Updated successfully", data: doc.toObject() };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const uploadAvatar = async (userId, file) => {
  try {
    if (!file) {
      return { status: false, error: 1, message: "No file uploaded", data: null };
    }

    // upload buffer lên Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "avatars",
          public_id: userId.toString(), // mỗi user 1 avatar
          overwrite: true,
          resource_type: "image",
          transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto" },
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file.buffer);
    });

    const avatarUrl = uploadResult.secure_url;

    await Profile.findOneAndUpdate(
      { userId },
      { $set: { avatarUrl } },
      { new: true, upsert: true }
    );

    return {
      status: true,
      error: 0,
      message: "Avatar uploaded successfully",
      data: { avatarUrl },
    };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const softDeleteMyProfile = async (userId) => {
  try {
    const doc = await Profile.delete({ userId });
    return { status: true, error: 0, message: "Deleted successfully", data: doc };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

const restoreMyProfile = async (userId) => {
  try {
    const doc = await Profile.restore({ userId });
    return { status: true, error: 0, message: "Restored successfully", data: doc };
  } catch (error) {
    return { status: false, error: -1, message: error.message, data: null };
  }
};

module.exports = {
  getMyProfile,
  upsertMyProfile,
  uploadAvatar,
  softDeleteMyProfile,
  restoreMyProfile,
};
