/**
 * Sync the data from rest point
 * @method sync
 * @param  {Function} callback Callback(error, result)
 */
CacheSync.prototype.load = Meteor.wrapAsync(function(callback) {
  var self = this;

  // Check if caching is paused
  if (CacheSync.isPaused) {
    CacheSync.state.emit('waiting', {
      name: self.name,
      type: 'paused',
      reason: 'load waiting, CacheSync is paused'
    });
    return callback();
  }

  if (typeof self.paginatedUrl !== 'function') {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'load not supported',
      message: 'load requires paginatedUrl function'
    });
    callback(new Error('CacheSync: "' + self.name + '" is missing paginatedUrl setting'));
    return;
  }

  // Lookup last status
  var status = CacheSync.getStatus(self.name);

  CacheSync.state.emit('loadCalled', { name: self.name });

  // Use the correct url - we either fetch pages or load latest updates
  var url = self.paginatedUrl(status.page * self.limit, self.limit);

  CacheSync.state.emit('loading', { name: self.name, page: status.page });

  var modifier = {
    $set: {
      loadAt: new Date(),
      page: status.page + 1,
      updatedAt: status.updatedAt
    },
    $inc: {
      'count.inserted': 0,
      'count.updated': 0,
      'count.removed': 0,
      'count.issues': 0
    }
  };

  // If the collection is initialized and loading page 0 we add an "__old_cache_document" flag to each of the
  // documents in the collection. When the load has completed we strip all documents still carrying
  // the "__old_cache_document" flag in order to sync removal of documents.
  if (self.autoRemove && status.initialized && status.page === 0) {
    self.collection.update({}, { $inc: { '__old_cache_document': 1 } }, { multi: true});
  }

  // Call rest point
  self.httpCall(url, function(err, list) {
    if (!err) {

      list.forEach(function(doc) {

        // Get updated at
        self.calcLastUpdated(doc);

        // Set the updatedAt
        modifier.$set.updatedAt = self.lastUpdatedAt;

        var cacheStatus = self.cacheDocument(doc);

        if (cacheStatus.inserted) {

          CacheSync.state.emit('inserted', { name: self.name, id: cacheStatus.transformedDocument._id });
          modifier.$inc['count.inserted']++;

        } else if (cacheStatus.updated) {

          CacheSync.state.emit('updated', { name: self.name, id: cacheStatus.transformedDocument._id });
          modifier.$inc['count.updated']++;

        } else if (cacheStatus.error) {

          modifier.$inc['count.issues']++;

        }

      });

      // If page loading and no more documents, then stop page loading
      if (list.length < self.limit) {
        // Set page to 0 for the the next run
        modifier.$set.page = 0;

        // Remove all documents not synchronized, these are removed from the collection
        self.collection.find({ '__old_cache_document': { $gte: self.removalLimit } }).forEach(function(doc) {
          // Document to remove

          // Emit event if any documents were removed
          if (self.collection.remove({ _id: doc._id })) {
            CacheSync.state.emit('removed', { name: self.name, id: doc._id });
            modifier.$inc['count.removed']++;
          }
        });

        // Emit end event
        CacheSync.state.emit(self.name + '.loaded', { name: self.name, page: status.page });
        CacheSync.state.emit('loaded', { name: self.name, page: status.page });

        if (!status.initialized) {
          modifier.$set.initialized = true;

          CacheSync.state.emitState(self.name + '.initialized', { name: self.name, page: status.page });
          CacheSync.state.emitState('initialized', { name: self.name, page: status.page });

        }

      } else {
        CacheSync.state.emit(self.name + '.load', { name: self.name, page: status.page });
        CacheSync.state.emit('load', { name: self.name, page: status.page });
      }

      // Update the load status
      // Load updates
      // $set
      // * loadAt
      // * updatedAt
      // $inc
      // * count.inserted
      // * count.updated
      // * count.removed
      // * count.issues
      CacheSync.status.update({ _id: self.name }, modifier);

      // load done
      callback(null);

    } else {
      // Error callback
      callback(err);
    }
  });

});
