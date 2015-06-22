/* global CacheSync: true, EventState: true */
/* jshint maxlen: 160 */
/* global Logstar: false, check: false, Meteor: false */

/**
 * Cache sync object for connecting a restpoint data to a Mongo collection
 * @method CacheSync
 * @param  {Object}  options
 * @param {Mongo.Collection} options.collection The target collection
 * @param {Function} options.headers Function returning header object or null
 *                                   if not authenticated
 * @param {Function} options.updatedAtUrl Returns url for updates since last
 *                                        update f(lastUpdatedAt)
 * @param {Function} options.singleUrl Returns url for a single document f(selector)
 * @param {Function} options.paginatedUrl Returns url for paginated data f(offset, limit)
 * @param {Function} options.list Returns a list of documents from result
 * @param {Function} options.updatedAt Returns the updatedAt from a document f(d)
 * @param {Function} options.selector Returns mongo selector from document f(doc)
 * @param {Function} options.transform Returns transformed document ready for db
 * @param {Function} [options.check] Run check function on document before adding it to db
 * @param {Number}   [options.limit] Optional limit on paginated data
 * @param {Number}   [options.everyTick] Default is 1, 2 = every other tick etc.
 * @param {Function} [options.generateId] function(doc) { return doc._id; } default is Random.id();
 */
CacheSync = function(options) {
  var self = this;

  // Check options
  check(options, {
    collection: Mongo.Collection,
    headers: Function,
    paginatedUrl: Function,
    list: Function,
    selector: Function,
    singleUrl: Match.Optional(Function),
    updatedAtUrl: Match.Optional(Function),
    updatedAt: Match.Optional(Function),
    transform: Match.Optional(Function),
    check: Match.Optional(Object),
    dateToString: Match.Optional(Function),
    limit: Match.Optional(Number),
    everyTick: Match.Optional(Number),
    generateId: Match.Optional(Function),
    after: Match.Optional(Function)
  });

  _.extend(self, {
    limit: 100,
    _tick: 0,
    everyTick: 1,
    name: options.collection._name,
    updatedAt: function() { return null; },
    transform: function(doc) { return doc; },
    dateToString: function(date) { return date.toString(); },
    generateId: function() { return Random.id(); }
  }, options);

};

// Add a status collection, keeping track of updates
CacheSync.status = new Mongo.Collection('_CS_cache_status');

// Pause flag, if set true then cache sync will halt
CacheSync.isPaused = false;

CacheSync.pause = function() {
  // Check if already paused
  if (CacheSync.isPaused) return;
  // Set pause flag
  CacheSync.isPaused = true;
  CacheSync.state.emit('paused');
  // xxx: publish the status in CacheSync.status?
};

CacheSync.resume = function() {
  // Check if already running
  if (!CacheSync.isPaused) return;

  // Set pause flag
  CacheSync.isPaused = false;
  CacheSync.state.emit('resumed');
  // xxx: publish the status in CacheSync.status?
};

CacheSync.state = new EventState();

Meteor.startup(function() {
  CacheSync.status.find().observe({
    added: function(doc) {
      if (doc.initialized) {
        CacheSync.state.emitState(doc._id + '.initialized');
        CacheSync.state.emit('initialized', { id: newDoc._id });
      }
    },
    changed: function(newDoc, oldDoc) {
      if (newDoc.initialized && !oldDoc.initialized) {
        CacheSync.state.emitState(newDoc._id + '.initialized');
        CacheSync.state.emit('initialized', { id: newDoc._id });
      }
    },
    removed: function(/* oldDoc */ ) {

    }
  });
});

CacheSync.reload = function(id) {

  var n = CacheSync.status.update({ _id: id }, {
    $unset: {
      updatedAt: 1,
      loading: 1
    }
  });

  if (n) {
    CacheSync.state.emit('reload', { name: id });
  }
};

var _initialSkip = function(name) {
  // Count initializing loading collections
  var countLoading = CacheSync.status.find({
    $and: [
      // If not clean polling / updatedAt not supported
      { updatedAt: { $ne: null } },
      // If not already initialized / allow others to sync while running a resync
      // otherwise a resync will block the regular sync function
      { initialized: { $ne: true } },
      // And loading
      { loading: true }
    ]
  }).count();

  // Check if this collection is found in status yet
  var thisCollection = CacheSync.status.findOne({ _id: name });

  // Check existence
  if (!thisCollection) {

    // If countLoading the collection haven't been initialized and we still have others loading, then skip this
    // collection for now
    // If not countLoading the collection haven't been initialized and all others are ready then start loading
    // this collection

    return !!countLoading;
  }

  var ready = !(thisCollection.loading && thisCollection.updatedAt !== null);

  if (ready && countLoading) {
    // This collection is ready but others are not, so we skip this collection
    // for now
    return true;
  }

  // All initialized or this one is missing
  return false;
};

/**
 * Sync the data from rest point
 * @method sync
 * @param  {Function} callback Callback(error, result)
 * @param  {string} id Optional id
 */
CacheSync.prototype.sync = function(callback, id) {
  var self = this;

  // Check if caching is paused
  if (CacheSync.isPaused) {
    CacheSync.state.emit('waiting', {
      name: self.name,
      type: 'paused',
      reason: 'waiting, CacheSync is paused'
    });
    return callback();
  }

  // Check if we want to skip this while initializing
  if (_initialSkip(self.name)) {
    CacheSync.state.emit('waiting', {
      name: self.name,
      type: 'initializing',
      reason: 'waiting for other collections to initialize'
    });
    return callback();
  }


  // Lookup last status
  var lastUpdatedAtDoc = CacheSync.status.findOne({ _id: self.name });

  // Current last updated at
  var lastUpdatedAt = lastUpdatedAtDoc && lastUpdatedAtDoc.updatedAt || null;

  // Current page
  var page = lastUpdatedAtDoc && lastUpdatedAtDoc.page || 0;

  // Current status
  var isPageLoading = (lastUpdatedAtDoc && lastUpdatedAt) ? lastUpdatedAtDoc.loading : true;

  // Is initialized
  var isInitialized = lastUpdatedAtDoc && lastUpdatedAtDoc.initialized || false;

  if (id) {

    // If user tries to do syncOne while not initialized we break since cache is not
    // ready, we might miss the update now but the resync will catch this later on
    if (!isInitialized) {
      // Break
      return callback();
    }
  } else {
    CacheSync.state.emit('syncCalled', { name: self.name });

    // Add everyTick option - this allows the sync to go down in interval on
    // regular sync
    if (!isPageLoading) {
      // Increment the sync tick
      self._tick++;

      if (self._tick < self.everyTick) {
        // As long as the tick is lower than target we skip this sync
        return callback();
      } else {
        // Reset the tick counter and do the sync
        self._tick = 0;
      }
    }

  }


  // Use the correct url - we either fetch pages or load latest updates
  var url = (isPageLoading)?
          self.paginatedUrl(page * self.limit, self.limit) : self.updatedAtUrl(lastUpdatedAt);

  // Support single id updates
  if (id) {
    url = self.singleUrl(id);
  }

  // Get the headers
  var headers = self.headers();

  // We check if headers are set - if not auth token might not be ready?
  if (!headers) {
    var headerMissingError = new Error('No header is set');
    CacheSync.state.emit('error', { name: self.name, type: 'missing header', error: headerMissingError });
    return callback(headerMissingError);
  }

  if (isPageLoading) {
    CacheSync.state.emit('loading', { name: self.name, page: page });
  } else {
    CacheSync.state.emit('sync', { name: self.name, lastUpdatedAt: lastUpdatedAt });
  }

  // Call rest point
  HTTP.get(url, {
    headers: headers
  }, function(err, result) {
    if (err) {
      // Add retry logic
      CacheSync.state.emit('error', { name: self.name, type: 'http request', url: url, headers: headers, error: err });
      callback(err);
    } else {

      // Get the list
      var list = self.list(result && result.data || {}) || [];

      var currentLastUpdatedAt = lastUpdatedAt;

      var count = {
        documents: 0,
        updated: 0,
        inserted: 0,
        issues: 0
      };

      try {
        list.forEach(function(doc) {
          // Rest point bug workaround - documents should have updated at
          // greater than current last updated at
          if (!isPageLoading && self.updatedAt(doc) && self.updatedAt(doc) <= currentLastUpdatedAt) {
            return;
          }

          // Add stats
          count.documents++;

          // Check if doc already found
          var lookupDoc = self.collection.findOne(self.selector(doc));

          // Get the id
          var id = lookupDoc && lookupDoc._id || self.generateId(doc);

          // Get updated at
          var updatedAt = self.updatedAt(doc);

          // Update the last updated at
          if (!lastUpdatedAt || updatedAt > lastUpdatedAt) {
            lastUpdatedAt = updatedAt;
          }

          // Transformed doc
          var newDoc = self.transform(doc, true);

          // Modifier check
          var modifiedDb = null;

          // Check the doc
          if (self.check) {
            try {
              check(newDoc, self.check);
            } catch (error) {
              CacheSync.state.emit('error', {
                name: self.name,
                type: 'schema',
                error: "document does not match schema: " + error.message + '-' + JSON.stringify(newDoc)
              });
              return;
            }
          }

          // Check if transform created the document
          // this might happen when doing denormalization in the transform
          //
          // We could use upsert but would loose stats counter
          lookupDoc = self.collection.findOne({ _id: id });

          // Insert/update
          if (lookupDoc) {

            // Check if the data is equal
            if (_.isEqual(lookupDoc, _.extend({ _id: id }, newDoc ))) {
              return;
            }

            // Update
            CacheSync.state.emit('update', { name: self.name, id: id });
            count.updated++;
            modifiedDb = self.collection.update({ _id: id }, newDoc);
          } else {
            // Insert
            CacheSync.state.emit('insert', { name: self.name, id: id });
            count.inserted++;
            newDoc._id = id;
            modifiedDb = self.collection.insert(newDoc);
          }

          if (!modifiedDb) {
            CacheSync.state.emit('issue', { name: self.name, doc: newDoc });
            count.issues++;
          } else {
            CacheSync.state.emit('cached', { name: self.name, id: id });

            // Run after hooks
            self.after && self.after(lookupDoc, newDoc);
          }
        });

        // If page loading and no more documents, then stop page loading
        if (isPageLoading && (!count.documents || count.documents < self.limit)) {
          if (lastUpdatedAt === null) {
            // This is a case where lastUpdatedAt is null so the rest point
            // doesn't support updatedAt so we set page to -1 and let it inc
            // to 0 for the the next run
            page = -1;
          } else {
            isPageLoading = false;
            // Set the lastUpdatedAt back in time when ready - this way we
            // make sure any updates are catched while initializing the data
            // Calc the time diff between creation and now
            // var ldiff = new Date() - lastUpdatedAtDoc.createdAt;
            // Subtract time diff and 10 sec in margin
            // var ld = new Date(new Date(lastUpdatedAt) - ldiff - 10000);
            // Update the last updated at, converting ld date to string
            //lastUpdatedAt = self.dateToString(ld);
            // Emit end event
            CacheSync.state.emit('loaded.' + self.name, { name: self.name, page: page });
            CacheSync.state.emit('loaded', { name: self.name, page: page });
          }
        }

        // If page loading then increment page count
        if (isPageLoading) {
          page++;
        } else {
          // If not loading pages then collection is initialized, make
          // sure flag is set true
          isInitialized = true;
        }

        // We don't update status for syncOne - this could break on going resyncs
        if (!id) {
          if (lastUpdatedAtDoc) {
            var c = CacheSync.status.update({ _id: self.name }, {
              updatedAt: lastUpdatedAt,
              loading: isPageLoading,
              initialized: isInitialized,
              page: page,
              syncAt: new Date(),
              count: {
                inserted: lastUpdatedAtDoc.count.inserted + count.inserted,
                updated: lastUpdatedAtDoc.count.updated + count.updated,
                issues: lastUpdatedAtDoc.count.issues + count.issues
              },
              createdAt: lastUpdatedAtDoc.createdAt
            });
          } else {
            // Insert the status
            CacheSync.status.insert({
              _id: self.name,
              updatedAt: lastUpdatedAt,
              loading: isPageLoading,
              initialized: isInitialized,
              page: page,
              syncAt: new Date(),
              count: {
                inserted: count.inserted,
                updated: count.updated,
                issues: count.issues
              },
              createdAt: new Date()
            });
          }

          CacheSync.state.emit('synchronized.' + self.name, { name: self.name });
          CacheSync.state.emit('synchronized', { name: self.name });

        }

        // Sync done
        callback(null);

        } catch(error) {
          CacheSync.state.emit('error', { name: self.name, error: error });
          callback(err);
        }

    }
  });

};

// Make helper
CacheSync.prototype.syncOne = Meteor.wrapAsync(function(id, callback) {
  var self = this;

  // Make sure id is string
  id = ''+id;

  if (self.singleUrl) {
    CacheSync.state.emit('syncOneCalled', { name: self.name, id: id });
    self.sync(function(error /*, result */) {
      if (error) {
        // Pass on error
        callback(error);
      } else {
        // Return the newly synchronized document
        callback(null, self.collection.findOne(id));
      }
    }, id);
  } else {
    var message = 'syncOne requires "singleUrl" to be set on "' + self.name + '"';

    CacheSync.state.emit('error', { name: self.name, type: 'sync one', error: message });

    // Callback error
    callback(message);
  }
});
