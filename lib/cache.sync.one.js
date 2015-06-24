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
      reason: 'loadOne waiting, CacheSync is paused'
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

  // Lookup last status
  var status = CacheSync.getStatus(self.name);

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
      CacheSync.status.update({ _id: self.name }, modifier);

      // load done
      callback(null);

    }
  });

});
