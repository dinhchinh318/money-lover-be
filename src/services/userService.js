const User = require("../models/user")

// createUser
const createUser = async (user) => {
    try {
        const existingUser = await User.findOne({ email: user.email });
        if (existingUser) {
            return {
                status: false,
                error: -1,
                message: "Existed email. Please try another!",
                data: null
            }
        }
        const newUser = new User({
            ...user,
            isActive: true
        });
        await newUser.save();
        // After save newUser, _id is already
        // user not sure have _id, i think that, check my code
        // const createdUser = await User.findById(user._id).select("-password -refreshToken");
        const createdUser = await User.findById(newUser._id).select("-password -refreshToken");
        return {
            status: true,
            error: 0,
            message: "Create user successfully!",
            data: createdUser
        }
    } catch (error) {
        return {
            status: false,
            error: -1,
            message: "Error from server!",
            data: null
        }
    }
}

// createMultipleUser
const createMultipleUser = async (users) => {
    try {
        let data = await User.insertMany(users);
        return data || null;
    } catch (error) {
        console.log(error);
        return null;
    }
}
// getAUser
const getAUser = async (id) => {
    try {
        let data = await User.findById(id);
        return data || null;
    } catch (errror) {
        console.log(error);
        return null;
    }
}

// getUser
const getUser = async () => {
    try {
        let data = await User.find({});
        return data || null;
    } catch (error) {
        console.log(error);
        return null;
    }
}

// updateUser
const updateUser = async (user) => {
    try {
        const { id, ...updateData } = user;

        // Xóa các field không được phép update
        delete updateData.password;
        delete updateData.refreshToken;
        delete updateData.email; // Email không được đổi

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select("-password -refreshToken");

        if (!updatedUser) {
            return {
                status: false,
                error: 1,
                message: "User not found",
                data: null,
            };
        }

        return {
            status: true,
            error: 0,
            message: "Updated successfully",
            data: updatedUser,
        };
    } catch (error) {
        console.error("Error updating user:", error);
        return {
            status: false,
            error: -1,
            message: error.message || "Error updating user",
            data: null,
        };
    }
}

// deleteUser
////////////////////
// CHECK!!!!!!!!!!!
////////////////////
const deleteUser = async (user) => {
    try {
        const id = user._id;
        let data = await User.deleteById(id);
        return data || null;
    } catch (error) {
        console.log(error);
        return null;
    }
}

// deleteMultipleUser
const deleteMultipleUser = async (arrUser) => {
    try {
        const arrId = arrUser.map(item => item.id);
        let data = await User.delete({ _id: { $in: arrId } });
        return data || null;
    } catch (error) {
        console.log(error);
        return null;
    }
}

// module.exports
module.exports = {
    createUser, getUser, updateUser, deleteUser, createMultipleUser, deleteMultipleUser, getAUser
}