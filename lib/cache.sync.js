/**
 * Sync the data from rest point
 * @method sync
 * @param  {Function} callback Callback(error, result)
 */
CacheSync.prototype.sync = Meteor.wrapAsync(function(callback) {
  var self = this;

  // Check if caching is paused
  if (CacheSync.isPaused) {
    CacheSync.state.emit('waiting', {
      name: self.name,
      type: 'paused',
      message: 'sync waiting, CacheSync is paused'
    });

    callback();
    return;
  }

  var status;

  try {
    // Lookup last status
    status = CacheSync.getStatus(self.name);
  } catch(error) {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'get-status',
      message: error && error.message || error || 'could not get status'
    });
    callback(new Error('CacheSync: "' + self.name + '" could not get status'));
    return;
  }

  // CacheSync needs to be initialized before we can start synchronizing
  if (!status.initialized) {
    callback();
    return;
  }

  // When doing a sync we depend on a lastUpdatedAt date - if not present
  // it might not be supported by the restpoint.
  // Note:
  // We check the count in the db - it could be that theres no data. This will mark the collection as
  // "initialized" and without a "updatedAt" in this case we don't complain.

  var collectionEmpty = true;

  try {
    collectionEmpty = !self.collection.findOne();
  } catch(error) {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'check-if-collection-is-empty',
      message: error && error.message || error || 'could not check if collection was empty'
    });
  }

  if (!status.updatedAt && !collectionEmpty) {

    CacheSync.state.emit('error', {
      name: self.name,
      type: 'sync-not-supported',
      message: 'sync requires updatedAt timestamp'
    });
    callback(new Error('CacheSync: "' + self.name + '" is initialized, sync requires updatedAt timestamp'));
    return;
  }

  var modifier = {
    $set: {
      syncAt: new Date(),
      updatedAt: status.updatedAt
    },
    $inc: {
      'count.inserted': 0,
      'count.updated': 0,
      'count.issues': 0
    }
  };

  CacheSync.state.emit('syncCalled', { name: self.name });

  // Use the correct url - we either fetch pages or load latest updates
  var url = self.updatedAtUrl(status.updatedAt, self.limit);

  CacheSync.state.emit('sync', { name: self.name, lastUpdatedAt: status.updatedAt });

  // Call rest point
  self.httpCall(url, function(err, list) {
    if (!err) {

      var currentLastUpdatedAt = self.lastUpdatedAt;

      list.forEach(function(doc) {
        // Rest point bug workaround - documents should have updated at
        // greater than current last updated at
        if (self.updatedAt(doc) && self.updatedAt(doc) <= currentLastUpdatedAt) {
          return;
        }

        // Get updated at
        self.calcLastUpdated(doc);

        // Set the updatedAt
        modifier.$set.updatedAt = self.lastUpdatedAt;

        var cacheStatus = {};

        try {
          cacheStatus = self.cacheDocument(doc);
        } catch(error) {
          cacheStatus.error = error;

          CacheSync.state.emit('error', {
            name: self.name,
            type: 'cache-document',
            message: error && error.message || error
          });
        }

        if (cacheStatus.error) {

          modifier.$inc['count.issues']++;

        }

        if (cacheStatus.inserted) {

          CacheSync.state.emit('inserted', { name: self.name, id: cacheStatus.transformedDocument._id });
          modifier.$inc['count.inserted']++;

        }

        if (cacheStatus.updated) {

          CacheSync.state.emit('updated', { name: self.name, id: cacheStatus.transformedDocument._id });
          modifier.$inc['count.updated']++;

        }


      });

      modifier.$set.syncAt = new Date();

      // Sync updates
      // $set
      // * syncAt
      // * updatedAt
      // $inc
      // * count.inserted
      // * count.updated
      // * count.issues
      CacheSync.state.emit(self.name + '.synchronized', { name: self.name });
      CacheSync.state.emit('synchronized', { name: self.name });

      // Sync done
      CacheSync.status.update({ _id: self.name }, modifier, callback);

    } else {
      // Error callback
      callback(err);
    }
  });

});
