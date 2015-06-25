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
      reason: 'sync waiting, CacheSync is paused'
    });

    callback();
    return;
  }

  // Lookup last status
  var status = CacheSync.getStatus(self.name);

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

  if (!status.updatedAt && self.collection.findOne()) {

    CacheSync.state.emit('error', {
      name: self.name,
      type: 'sync not supported',
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

      modifier.$set.syncAt = new Date();

      // Sync updates
      // $set
      // * syncAt
      // * updatedAt
      // $inc
      // * count.inserted
      // * count.updated
      // * count.issues
      CacheSync.status.update({ _id: self.name }, modifier);

      CacheSync.state.emit('synchronized.' + self.name, { name: self.name });
      CacheSync.state.emit('synchronized', { name: self.name });

      // Sync done
      callback(null);

    } else {
      // Error callback
      callback(err);
    }
  });

});
