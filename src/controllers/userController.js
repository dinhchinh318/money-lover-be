const { createUser, getUser, updateUser, deleteUser, createMultipleUser, deleteMultipleUser, getAUser } = require("../services/userService");

const createUserAPI = async (req, res) => {
    let user = await createUser(req.body);
    if (user) {
        return res.status(201).json(
            {
                EC: 0,
                data: user
            }
        )
    }
    return res.status(200).json(
        {
            EC: -1,
            data: null
        }
    )
}
const createMultipleUserAPI = async (req, res) => {
    let arrUser = await createMultipleUser(req.body.users);
    if (arrUser) {
        return res.status(201).json(
            {
                EC: 0,
                data: arrUser
            }
        )
    }
    return res.status(201).json(
        {
            EC: -1,
            data: null
        }
    )
}
const getUserAPI = async (req, res) => {
    let user = await getUser();
    if (user) {
        return res.status(200).json(
            {
                EC: 0,
                data: user
            }
        )
    }
    return res.status(200).json(
        {
            EC: -1,
            data: null
        }
    )
}
const getAUserAPI = async (req, res) => {
    let user = await getAUser(req.params.id);
    if (user) {
        return res.status(200).json(
            {
                EC: 0,
                data: user
            }
        )
    }
    return res.status(200).json(
        {
            EC: -1,
            data: null
        }
    )
}
const updateUserAPI = async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const updateData = {
            id: userId,
            ...req.body,
        };

        const result = await updateUser(updateData);

        if (result && result.status) {
            return res.status(200).json({
                EC: 0,
                message: result.message || "Updated successfully",
                data: result.data,
            });
        }

        return res.status(200).json({
            EC: result?.error || -1,
            message: result?.message || "Update failed",
            data: null,
        });
    } catch (error) {
        return res.status(500).json({
            EC: -1,
            message: error.message || "Server error",
            data: null,
        });
    }
}
const deleteUserAPI = async (req, res) => {
    let user = await deleteUser(req.body);
    if (user) {
        return res.status(200).json(
            {
                EC: 0,
                data: user
            }
        )
    }
    return res.status(200).json(
        {
            EC: -1,
            data: null
        }
    )
}
const deleteMultipleUserAPI = async (req, res) => {
    let arrUser = await deleteMultipleUser(req.body.users);
    if (arrUser) {
        return res.status(200).json(
            {
                EC: 0,
                data: arrUser
            }
        )
    }
    return res.status(200).json(
        {
            EC: -1,
            data: null
        }
    )
}
module.exports = {
    createUserAPI, getUserAPI, updateUserAPI, deleteUserAPI, createMultipleUserAPI, deleteMultipleUserAPI, getAUserAPI
}
