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
    status.transformedDocument = _.omit(self.transform(doc, true), '__old_cache_document');
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

  var existingDocument;

  try {
    // Check if doc already found
    existingDocument = self.collection.findOne(self.selector(doc));
  } catch(error) {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'find-existing-document',
      message: error && error.message || error || 'failed to find existing document'
    });

    status.error;
  }

  // Get the id
  var id = existingDocument && existingDocument._id || self.generateId(doc);


  // Insert/update
  if (existingDocument) {

    // Check if the data is equal
    if (_.isEqual(_.omit(existingDocument, '__old_cache_document'), _.extend({ _id:id }, status.transformedDocument))) {
      try {
        // Remove the old cache flag
        self.collection.update({ _id: id }, { $unset: { '__old_cache_document' : true } });
      } catch(error) {
        CacheSync.state.emit('error', {
          name: self.name,
          type: 'remove-old-flag',
          message: "could not remove old flag: " + error.message + ', id: ' + id
        });

        status.error = error;
      }
      return status;
    }

    try {
      // Update
      modifiedDb = self.collection.update({ _id: id }, status.transformedDocument);
    } catch(error) {
      CacheSync.state.emit('error', {
        name: self.name,
        type: 'update-document',
        message: "could not update document: " + error.message + ', id: ' + id + '-' +
                JSON.stringify(status.transformedDocument)
      });

      status.error;
    }
    if (modifiedDb) {
      status.updated++;
    }
    status.transformedDocument._id = id;
  } else {
    status.transformedDocument._id = id;

    try {
      // Insert
      modifiedDb = self.collection.insert(status.transformedDocument);
    } catch(error) {
      CacheSync.state.emit('error', {
        name: self.name,
        type: 'insert-document',
        message: "could not insert document: " + error.message + ', id: ' + id + '-' +
                JSON.stringify(status.transformedDocument)
      });

      status.error;
    }

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
