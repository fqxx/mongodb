// utils.js
const mongoose = require("mongoose");

function exportDocument(document) {
    if (!document) return;
    
    // Convert Mongoose document to plain object
    if (document.toObject) {
        document = document.toObject();
    }
    
    // Ensure _id is a string
    if (document._id && typeof document._id !== "string") {
        document._id = document._id.toString();
    }
    return document;
};

function exportDocuments(documents) {
    if (!Array.isArray(documents)) return;
    return documents.map((document => exportDocument(document)));
}

function safeObjectArgument(object) {
    if (!object) return {};
    if (Array.isArray(object)) {
        return object.reduce((acc, value, index) => {
            acc[index] = value;
            return acc;
        }, {});
    }
    if (typeof object !== "object") return {};
    
    // Convert string IDs to ObjectId for MongoDB queries
    if (object._id && typeof object._id === "string") {
        try {
            object._id = mongoose.Types.ObjectId(object._id);
        } catch (e) {
            // If not a valid ObjectId, leave as is
            console.log(`[MongoDB][ERROR] Invalid ObjectId: ${object._id}`);
        }
    }
    return object;
}

function safeCallback(cb, ...args) {
    if (typeof cb === "function") return setImmediate(() => cb(...args));
    else return false;
}

module.exports = {
    exportDocument,
    exportDocuments,
    safeObjectArgument,
    safeCallback
}
