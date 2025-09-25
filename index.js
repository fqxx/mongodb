const mongoose = require("mongoose");
const utils = require("./utils");
mongoose.set('strictQuery', false);

const url = GetConvar("mongodb_url", "mongodb://localhost:27017");
const dbName = GetConvar("mongodb_database", "meov_fivem");

let isConnected = false;

if (url != "changeme" && dbName != "changeme") {
    const connectionString = url.includes(dbName) ? url : `${url}/${dbName}`;

    mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log(`[MongoDB] Connected to database "${dbName}" using Mongoose.`);
        isConnected = true;
        emit("onDatabaseConnect", dbName);
    }).catch(err => {
        console.log("[MongoDB][ERROR] Failed to connect: " + err.message);
    });
} else {
    if (url == "changeme") console.log(`[MongoDB][ERROR] Convar "mongodb_url" not set (see README)`);
    if (dbName == "changeme") console.log(`[MongoDB][ERROR] Convar "mongodb_database" not set (see README)`);
}

function checkDatabaseReady() {
    if (!isConnected) {
        console.log(`[MongoDB][ERROR] Database is not connected.`);
        return false;
    }
    return true;
}

function checkParams(params) {
    return params !== null && typeof params === 'object' && !Array.isArray(params);
}

function getParamsCollection(params) {
    if (!params.collection) {
        console.log(`[MongoDB][ERROR] getParamsCollection: Missing "collection" in params.`);
        return null;
    }

    const model = getModel(params.collection);
    if (!model || typeof model.find !== 'function') {
        console.log(`[MongoDB][ERROR] getParamsCollection: Invalid model for collection "${params.collection}". Ensure the model is defined and valid.`);
        return null;
    }

    return model;
}

/* MongoDB methods wrappers */

/**
 * MongoDB insert method
 * @param {Object} params - Params object
 * @param {Array}  params.documents - An array of documents to insert.
 * @param {Object} params.options - Options passed to insert.
 */
function dbInsert(params, callback) {
    if (!checkDatabaseReady()) return;
    if (!checkParams(params)) return console.log(`[MongoDB][ERROR] exports.insert: Invalid params object.`);

    let collection = getParamsCollection(params);
    if (!collection) return console.log(`[MongoDB][ERROR] exports.insert: Invalid collection "${params.collection}"`);

    let documents = params.documents;
    if (!documents || !Array.isArray(documents))
        return console.log(`[MongoDB][ERROR] exports.insert: Invalid 'params.documents' value. Expected object or array of objects.`);
    const options = utils.safeObjectArgument(params.options);

    collection.insertMany(documents, options, (err, result) => {
        if (err) {
            console.log(`[MongoDB][ERROR] exports.insert: Error "${err.message}".`);
            utils.safeCallback(callback, false, err.message);
            return;
        }
        let arrayOfIds = [];
        // Convert object to an array
        for (let key in result) {
            if (result.hasOwnProperty(key)) {
                arrayOfIds[parseInt(key)] = result[key]?._id?.toString();
            }
        }
        // console.log(`[MongoDB] Inserted ${result.insertedCount} documents into collection "${params.collection}".`, arrayOfIds);
        utils.safeCallback(callback, true, arrayOfIds.length, arrayOfIds);
    });
    process._tickCallback();
}

/**
 * MongoDB find method
 * @param {Object} params - Params object
 * @param {Object} params.query - Query object.
 * @param {Object} params.options - Options passed to insert.
 * @param {number} params.limit - Limit documents count.
 */
function dbFind(params, callback) {
    if (!checkDatabaseReady()) return;
    if (!checkParams(params)) return console.log(`[MongoDB][ERROR] exports.find: Invalid params object.`);

    let collection = getParamsCollection(params);
    if (!collection) {
        utils.safeCallback(callback, false, `Invalid collection "${params.collection}"`);
        return;
    }

    if (typeof collection.find !== 'function') {
        console.log(`[MongoDB][ERROR] exports.find: The collection "${params.collection}" does not have a valid "find" method. Ensure the model is correctly initialized.`);
        utils.safeCallback(callback, false, `Invalid collection "${params.collection}"`);
        return;
    }

    // Debugging: Log the schema of the collection
    if (collection.schema) {
        // console.log(`[MongoDB][DEBUG] Schema for collection "${params.collection}":`, collection.schema.obj);
    } else {
        console.log(`[MongoDB][ERROR] exports.find: No schema found for collection "${params.collection}". Ensure the schema is created using createSchema.`);
        utils.safeCallback(callback, false, `No schema found for collection "${params.collection}"`);
        return;
    }

    // Debugging: Log the collection instance
    // console.log(`[MongoDB][DEBUG] Collection instance for "${params.collection}":`, collection);

    const query = utils.safeObjectArgument(params.query);
    const options = utils.safeObjectArgument(params.options);

    let cursor;
    try {
        cursor = collection.find(query, options);
        // console.log(`[MongoDB][DEBUG] Cursor created for collection "${params.collection}" with query:`, query, "and options:", options);
    } catch (err) {
        console.log(`[MongoDB][ERROR] exports.find: Error creating cursor "${err.message}".`);
        utils.safeCallback(callback, false, err.message);
        return;
    }

    // Explicitly check if the cursor is a valid Mongoose Query object
    if (!(cursor instanceof mongoose.Query)) {
        console.log(`[MongoDB][ERROR] exports.find: Cursor is not a valid Mongoose Query object. Cursor:`, cursor);
        utils.safeCallback(callback, false, "Invalid cursor");
        return;
    }

    if (params.limit) cursor = cursor.limit(params.limit);
    cursor.exec((err, documents) => {
        if (err) {
            console.log(`[MongoDB][ERROR] exports.find: Error "${err.message}".`);
            utils.safeCallback(callback, false, err.message);
            return;
        }
        // console.log(`[MongoDB][DEBUG] Documents retrieved from collection "${params.collection}":`, documents);
        utils.safeCallback(callback, true, utils.exportDocuments(documents));
    });
    process._tickCallback();
}

/**
 * MongoDB update method
 * @param {Object} params - Params object
 * @param {Object} params.query - Filter query object.
 * @param {Object} params.update - Update query object.
 * @param {Object} params.options - Options passed to insert.
 */
function dbUpdate(params, callback, isUpdateOne) {
    if (!checkDatabaseReady()) return;
    if (!checkParams(params)) return console.log(`[MongoDB][ERROR] exports.update: Invalid params object.`);

    let collection = getParamsCollection(params);
    if (!collection) return console.log(`[MongoDB][ERROR] exports.insert: Invalid collection "${params.collection}"`);

    query = utils.safeObjectArgument(params.query);
    update = utils.safeObjectArgument(params.update);
    options = utils.safeObjectArgument(params.options);

    const cb = (err, res) => {
        if (err) {
            console.log(`[MongoDB][ERROR] exports.update: Error "${err.message}".`);
            utils.safeCallback(callback, false, err.message);
            return;
        }
        utils.safeCallback(callback, true, res.modifiedCount);
    };
    isUpdateOne ? collection.updateOne(query, update, options, cb) : collection.updateMany(query, update, options, cb);
    process._tickCallback();
}

/**
 * MongoDB count method
 * @param {Object} params - Params object
 * @param {Object} params.query - Query object.
 * @param {Object} params.options - Options passed to insert.
 */
function dbCount(params, callback) {
    if (!checkDatabaseReady()) return;
    if (!checkParams(params)) return console.log(`[MongoDB][ERROR] exports.count: Invalid params object.`);

    let collection = getParamsCollection(params);
    if (!collection) return console.log(`[MongoDB][ERROR] exports.insert: Invalid collection "${params.collection}"`);

    const query = utils.safeObjectArgument(params.query);
    const options = utils.safeObjectArgument(params.options);

    collection.countDocuments(query, options, (err, count) => {
        if (err) {
            console.log(`[MongoDB][ERROR] exports.count: Error "${err.message}".`);
            utils.safeCallback(callback, false, err.message);
            return;
        }
        utils.safeCallback(callback, true, count);
    });
    process._tickCallback();
}

/**
 * MongoDB delete method
 * @param {Object} params - Params object
 * @param {Object} params.query - Query object.
 * @param {Object} params.options - Options passed to insert.
 */
function dbDelete(params, callback, isDeleteOne) {
    if (!checkDatabaseReady()) return;
    if (!checkParams(params)) return console.log(`[MongoDB][ERROR] exports.delete: Invalid params object.`);

    let collection = getParamsCollection(params);
    if (!collection) return console.log(`[MongoDB][ERROR] exports.insert: Invalid collection "${params.collection}"`);

    const query = utils.safeObjectArgument(params.query);
    const options = utils.safeObjectArgument(params.options);

    const cb = (err, res) => {
        if (err) {
            console.log(`[MongoDB][ERROR] exports.delete: Error "${err.message}".`);
            utils.safeCallback(callback, false, err.message);
            return;
        }
        utils.safeCallback(callback, true, res.deletedCount); // Use `deletedCount` instead of `res.result.n`
    };
    isDeleteOne ? collection.deleteOne(query, options, cb) : collection.deleteMany(query, options, cb);
    process._tickCallback();
}

/* Exports definitions */

exports("isConnected", async () => isConnected);

exports("insert", async (params) => {
    return new Promise((resolve, reject) => {
        dbInsert(params, (success, ...results) => {
            if (success) resolve(results);
            else reject(results[0]);
        });
    });
});

exports("insertOne", async (params) => {
    if (checkParams(params)) {
        params.documents = [params.document];
        params.document = null;
    }
    return new Promise((resolve, reject) => {
        dbInsert(params, (success, ...results) => {
            if (success) resolve(results[1]);
            else reject(results[0]);
        });
    });
});

exports("find", async (params) => {
    return new Promise((resolve, reject) => {
        dbFind(params, (success, ...results) => {
            if (success) resolve(results[0]);
            else reject(results[0]);
        });
    });
});

exports("findOne", async (params) => {
    if (checkParams(params)) params.limit = 1;
    return new Promise((resolve, reject) => {
        dbFind(params, (success, ...results) => {
            if (success) resolve(results[0][0]);
            else reject(results[0]);
        });
    });
});

exports("update", async (params) => {
    return new Promise((resolve, reject) => {
        dbUpdate(params, (success, ...results) => {
            if (success) resolve(results);
            else reject(results[0]);
        });
    });
});

exports("updateOne", async (params) => {
    return new Promise((resolve, reject) => {
        dbUpdate(params, (success, ...results) => {
            if (success) resolve(results);
            else reject(results[0]);
        }, true);
    });
});

exports("count", async (params) => {
    return new Promise((resolve, reject) => {
        dbCount(params, (success, ...results) => {
            if (success) resolve(results);
            else reject(results[0]);
        });
    });
});

exports("delete", async (params) => {
    return new Promise((resolve, reject) => {
        dbDelete(params, (success, ...results) => {
            if (success) resolve(results);
            else reject(results[0]);
        });
    });
});

exports("deleteOne", async (params) => {
    return new Promise((resolve, reject) => {
        dbDelete(params, (success, ...results) => {
            if (success) resolve(results);
            else reject(results[0]);
        }, true);
    });
});

// Add a method to get a Mongoose model directly
exports("getModel", async (collectionName) => {
    return getModel(collectionName);
});

// Add a method to create a schema for a specific collection
exports("createSchema", async (collectionName, schemaDefinition) => {
    // console.log(`[MongoDB] Creating schema for collection "${collectionName}"`, schemaDefinition);

    if (!mongoose.models[collectionName]) {

        const schema = new mongoose.Schema(schemaDefinition, {
            collection: collectionName,
            versionKey: false
        });

        return mongoose.model(collectionName, schema);
    }

    return mongoose.model(collectionName);
});
