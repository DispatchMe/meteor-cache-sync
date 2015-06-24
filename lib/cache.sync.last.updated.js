CacheSync.prototype.calcLastUpdated = function(doc) {
  // Get updated at
  var updatedAt = this.updatedAt(doc);

  // Update the last updated at
  if (!this.lastUpdatedAt || updatedAt > this.lastUpdatedAt) {
    this.lastUpdatedAt = updatedAt;
  }
};
