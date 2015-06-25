CacheSync.prototype.httpCall = Meteor.wrapAsync(function(url, callback) {
  var self = this;

  // Get the headers
  var headers = self.headers();

  // We check if headers are set - if not auth token might not be ready?
  if (!headers) {

    CacheSync.state.emit('error', {
      name: self.name,
      type: 'http missing header',
      message: 'No header is set'
    });

    callback(new Error('No header is set'));
  } else {
    // Call rest point
    HTTP.get(url, {
      headers: headers
    }, function(err, result) {
      if (err) {
        // Add retry logic

        if (err.response.statusCode === 401) {
          CacheSync.state.emit('error', {
            name: self.name,
            type: 'http denied',
            url: url,
            headers: headers,
            response: err.response,
            message: err && err.message || err
          });
        }

        CacheSync.state.emit('error', {
          name: self.name,
          type: 'http request',
          url: url,
          headers: headers,
          response: err.response,
          message: err && err.message || err
        });

        callback(err);
      } else {
        // Get the list
        var list = self.list(result && result.data || {}) || [];

        callback(null, list);
      }
    });
  }
});
