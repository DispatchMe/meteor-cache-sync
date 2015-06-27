CacheSync.prototype.calcLastUpdated = function(doc) {
  var self = this;

  if (typeof self.updatedAt !== 'function') {
    CacheSync.state.emit('error', {
      name: self.name,
      type: 'get status',
      message: 'expected "updatedAt" in "' + self.name + '" to be a function'
    });
    return;
  }

  // Get updated at
  var updatedAt = self.updatedAt(doc);

  // Make sure we have an updatedAt
  if (!updatedAt) return;

  // Update the last updated at
  if (!self.lastUpdatedAt || updatedAt > self.lastUpdatedAt) {
    self.lastUpdatedAt = updatedAt;
  }
};
