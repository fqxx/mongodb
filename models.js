// Export a function that gets or creates a model for a collection
function getModel(collectionName) {
  // If the model is already registered, return it
  if (mongoose.models[collectionName]) {
    return mongoose.model(collectionName);
  }
  
  // Otherwise, create a new model for this collection
  const GenericSchema = new mongoose.Schema({}, { 
    strict: false, // Allow any fields to be stored
    versionKey: false // Remove __v field
  });
  
  return mongoose.model(collectionName, GenericSchema, collectionName);
}

getModel; // Making sure the function is declared in global scope
