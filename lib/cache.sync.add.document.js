CacheSync.prototype.cacheDocument = function(doc) {
  var self = this;

  // Modifier check
  var modifiedDb = null;

  var status = {
    originalDocument: doc,
    transformedDocument: null,
    updated: false,
    inserted: false,
    error: null
  };

  // Transformed doc
  try {
    status.transformedDocument = self.transform(doc, true);
  } catch(err) {
      CacheSync.state.emit('error', {
        name: self.name,
        type: 'transform',
        message: "document transform failed: " + err.message + '-' + JSON.stringify(doc)
      });

    status.error = err;
    return status;
  }

  // Check the doc
  if (self.check) {
    try {
      check(status.transformedDocument, self.check);
    } catch (err) {
      CacheSync.state.emit('error', {
        name: self.name,
        type: 'schema',
        message: "document does not match schema: " + err.message + '-' + JSON.stringify(status.transformedDocument)
      });

      status.error = err;

      // If the restricted check flag is true we omit database updates
      if (self.restrictedCheck) {
        return status;
      }
    }
  }

  // Check if doc already found
  var existingDocument = self.collection.findOne(self.selector(doc));

  // Get the id
  var id = existingDocument && existingDocument._id || self.generateId(doc);


  // Insert/update
  if (existingDocument) {

    // Check if the data is equal
    if (_.isEqual(_.omit(existingDocument, '__old_cache_document'), _.extend({ _id:id }, status.transformedDocument))) {
      return status;
    }

    // Update
    modifiedDb = self.collection.update({ _id: id }, status.transformedDocument);
    if (modifiedDb) {
      status.updated++;
    }
    status.transformedDocument._id = id;
  } else {
    // Insert
    status.transformedDocument._id = id;
    modifiedDb = self.collection.insert(status.transformedDocument);
    if (modifiedDb) {
      status.inserted++;
    }
  }

  if (modifiedDb) {
    // Run after hooks
    try {
      self.after && self.after(existingDocument, status.transformedDocument);
    } catch(err) {
      CacheSync.state.emit('error', {
        name: self.name,
        type: 'after',
        message: "after function failed: " + err.message + '-' + JSON.stringify(existingDocument) + '-' +
                JSON.stringify(status.transformedDocument)
      });
    }
  }

  return status;
};
