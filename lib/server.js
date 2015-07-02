/* global CacheSync: true, EventState: true */
/* jshint maxlen: 160 */
/* global check: false */

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
 * @param {Function} [options.generateId] function(doc) { return doc._id; } default is Random.id();
 */
CacheSync = function(options) {
  var self = this;

  if (!(self instanceof CacheSync)) {
    return new CacheSync(options);
  }

  // Check options
  check(options, {
    collection: Mongo.Collection,
    headers: Match.Optional(Function),
    paginatedUrl: Match.Optional(Function),
    updatedAtUrl: Match.Optional(Function),
    singleUrl: Match.Optional(Function),

    transform: Match.Optional(Function),
    check: Match.Optional(Object),
    limit: Match.Optional(Number),
    after: Match.Optional(Function),

    selector: Match.Optional(Function),
    updatedAt: Match.Optional(Function),
    list: Match.Optional(Function),
    generateId: Match.Optional(Function),
    dateToString: Match.Optional(Function),

    restrictedCheck: Match.Optional(Boolean),
    removalLimit: Match.Optional(Number),
    autoRemove: Match.Optional(Boolean)
  });

  // Index '__old_cache_document' for cached collections
  options.collection._ensureIndex({ '__old_cache_document': 1 });

  _.extend(self, {
    name: options.collection._name,
    limit: 100,
    lastUpdatedAt: null,
    removalLimit: 1, // Limit before removing documents flagged "__old_cache_document"
    autoRemove: true, // Sync will try to remove inactive documents
    restrictedCheck: false, // As default we don't restrict updates by the schema check - we just warn about it
    headers: function() { return {}; },
    updatedAt: function(doc) { return doc.updatedAt || doc.updated_at || doc.createdAt || doc.created_at || null; },
    transform: function(doc) { return doc; },
    dateToString: function(date) { return date.toString(); },
    generateId: function (doc) { return ''+doc.id; },
    list: function(result) {
      // []
      if (!result || _.isArray(result)) return result;

      var keys = _.keys(result);
      // Eg. like { foo: [] }
      if (keys.length === 1) {
        return result[keys[0]];
      }

      // can't guess this one
      return [];
    },
    selector: function(doc) {
      var id = doc._id || doc.id;
      return { _id: ''+id };
    }
  }, options);

  // Set initialized state
  Meteor.startup(function() {
    var status = CacheSync.getStatus(self.name);

    try {
      if (typeof options.updatedAtUrl === 'function') {
        CacheSync.status.update({ _id: self.name }, {
          $set: {
            loadAt: null,
            syncAt: null
          }
        });

      } else {
        CacheSync.status.update({ _id: self.name }, {
          $set: {
            updatedAt: null,
            loadAt: null,
            syncAt: null
          }
        });
      }
    } catch(err) {
      CacheSync.state.emit('error', {
        type: 'db startup update',
        message: err.message
      });
    }
    if (status.initialized) {
      CacheSync.state.emitState(self.name + '.initialized', { name: self.name, page: status.page });
      CacheSync.state.emitState('initialized', { name: self.name, page: status.page });
    }
  });
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

CacheSync.getStatus = function(name) {
  var self = this;

  check(name, String);

  // Get the status record or default
  var status = _.defaults(CacheSync.status.findOne({ _id: name }) || {}, {
    initialized: false,
    page: 0,
    count: {
      inserted: 0,
      updated: 0,
      removed: 0,
      issues: 0
    },
    createdAt: new Date(),
    updatedAt: null,
    syncAt: null,
    loadAt: null,
    loadedAt: null
  });

  // Create record if not found
  if (!status._id) {
    status._id = name;
    CacheSync.status.insert(status);
  }

  if (!self.lastUpdatedAt) {
    // Set lastUpdatedAt from the status record
    self.lastUpdatedAt = status.updatedAt;
  }

  return status;
};

CacheSync.state = new EventState();

CacheSync.state.on('error', function() {
  // Error event is handled specially on node throwing errors if no listener
  // is attached.
});
