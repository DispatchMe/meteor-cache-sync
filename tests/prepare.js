/* global CacheSync: false, HTTP: false, Mongo: false, console:false, Events: true */

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// HTTP
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var handle = {};

HTTP.get = function(url, options, callback) {
  handle = {
    url: url,
    options: options,
    callback: callback
  };
};

HTTP.getHandle = function() {
  return handle;
};

CacheSync.status = new Mongo.Collection(null);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// EVENTS
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var triggered = {};

Events = {
  wasTriggered: function(name, value) {
    var found = _.has(triggered, name);

    if (found && value) {
      return _.indexOf(triggered[name], JSON.stringify(value)) > -1;
    }

    return found;
  },
  getState: function(name) {
    if (triggered[name] && triggered[name].length) {
      return JSON.parse(_.last(triggered[name]));
    }
  },
  clear: function() {
    console.log('[Events] clear');
    triggered = {};
  }
};

var _emit = CacheSync.state.emit;

CacheSync.state.emit = function(name, data) {
  var jsonData = JSON.stringify(data);

  console.log('[Events] emit: "' + name + '"', jsonData);

  if (typeof triggered[name] === 'undefined') {
    triggered[name] = [];
  }

  triggered[name].push(jsonData);

  return _emit.apply(CacheSync.state, _.toArray(arguments));
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TEST SYNC
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var urlPrefix = 'http://test/v1/foo';

var name = 'foo';

foo = new Mongo.Collection('test_' + name, { connection: null });

fooCache = new CacheSync({
  collection: foo,

  headers: function() {
    return {
      auth: 'set'
    }
  },

  paginatedUrl: function(offset, limit) {
    return urlPrefix + '?sort=id+desc&limit=' + limit + '&offset=' + offset;
  },

  singleUrl: function(id) {
    return urlPrefix + '?filter[id]=' + id;
  },

  updatedAtUrl: function(updatedAt) {
    return urlPrefix + '?filter[updated_at_gt]=' + updatedAt;
  },

  updatedAt: function(doc) {
    return doc.updatedAt;
  },

  list: function(result) {
    return result && result.foo;
  },

  selector: function(doc) {
    return { $or: [
      // Match any old id's
      { id: ''+doc.id },
      { id: +doc.id },
      // Match all new _id's
      { _id: ''+doc.id }
    ]
    };
  },

  generateId: function (doc) {
    return ''+doc.id;
  },

  transform: function(doc) {
    return doc;
  },
  // everyTick: 5,
  // dateToString: dateToString,
  check: {
    id: Number,
    name: String,
    updatedAt: Date
  }
});
