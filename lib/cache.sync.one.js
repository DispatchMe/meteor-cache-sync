/**
 * Sync the data from rest point
 * @method sync
 * @param  {Function} callback Callback(error, result)
 */
CacheSync.prototype.loadOne = Meteor.wrapAsync(function(id, callback) {
  var self = this;

  // Check if caching is paused
  if (CacheSync.isPaused) {
    CacheSync.state.emit('waiting', {
      name: self.name,
      type: 'paused',
      message: 'loadOne waiting, CacheSync is paused'
    });
    return callback();
  }

  if (typeof self.singleUrl !== 'function') {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'loadOne not supported',
      message: 'load requires singleUrl function'
    });
    callback(new Error('CacheSync: "' + self.name + '" is missing singleUrl setting'));
    return;
  }

  var status;

  try {
    // Lookup last status
    status = CacheSync.getStatus(self.name);
  } catch(error) {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'get status',
      message: error && error.message || error
    });
    callback(new Error('CacheSync: "' + self.name + '" could not get status'));
    return;
  }

  CacheSync.state.emit('loadOneCalled', { name: self.name, id: id });

  // Use the correct url - we either fetch pages or load latest updates
  var url = self.singleUrl(id);

  CacheSync.state.emit('loadingOne', { name: self.name, id: id });

  var modifier = {
    $set: {
      updatedAt: status.updatedAt
    },
    $inc: {
      'count.inserted': 0,
      'count.updated': 0,
      'count.issues': 0
    }
  };

  // Call rest point
  self.httpCall(url, function(err, list) {
    if (!err) {

      list.forEach(function(doc) {

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
            type: 'cache document',
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

      if (list.length) {
        CacheSync.state.emit('loadOne.' + self.name, { name: self.name, id: id });
        CacheSync.state.emit('loadOne', { name: self.name, id: id });
      }
      // Update the load status
      // Load updates
      // $set
      // * updatedAt
      // $inc
      // * count.inserted
      // * count.updated
      // * count.issues
      // load done
      CacheSync.status.update({ _id: self.name }, modifier, callback);

    } else {
      // Error callback
      callback(err);
    }
  });

});
