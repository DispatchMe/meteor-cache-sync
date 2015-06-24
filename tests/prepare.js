/* global CacheSync: false, HTTP: false, Mongo: false, console:false, Events: true, fooCache: true, foo: true */

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

var _emitState = CacheSync.state.emitState;

CacheSync.state.emitState = function(name, data) {
  var jsonData = JSON.stringify(data);

  console.log('[Events] emitState: "' + name + '"', jsonData);

  if (typeof triggered[name] === 'undefined') {
    triggered[name] = [];
  }

  triggered[name].push(jsonData);

  return _emitState.apply(CacheSync.state, _.toArray(arguments));
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TEST SYNC
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var urlPrefix = 'http://test/v1/foo';

foo = new Mongo.Collection('test_foo', { connection: null });

fooCache = new CacheSync({
  collection: foo,

  headers: function() {
    return {
      auth: 'set'
    };
  },

  paginatedUrl: function(offset, limit) {
    return urlPrefix + '?sort=id+desc&limit=' + limit + '&offset=' + offset;
  },

  singleUrl: function(id) {
    return urlPrefix + '?filter[id]=' + id;
  },

  updatedAtUrl: function(updatedAt, limit) {
    return urlPrefix + '?filter[updated_at_gt]=' + updatedAt + '&limit=' + limit;
  },

  check: {
    id: Number,
    name: String,
    updatedAt: Date
  }
});
