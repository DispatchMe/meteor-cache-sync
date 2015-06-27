Cache-Sync
==========

#### Usage:
First configure restpoint and collection:
```js
var urlPrefix = 'http://test/v1/foo';

var name = 'foo';

foo = new Mongo.Collection('test_' + name);

fooCache = new CacheSync({
  // Set target collection
  collection: foo,

  // Return headers authenticating the http call
  headers: function() {
    return {
      auth: 'set'
    }
  },

  // Return paginated url for loading
  paginatedUrl: function(offset, limit) {
    return urlPrefix + '?sort=id+desc&limit=' + limit + '&offset=' + offset;
  },

  // Return url for a single document
  singleUrl: function(id) {
    return urlPrefix + '?filter[id]=' + id;
  },

  // Return updates from date url for synchronization
  updatedAtUrl: function(updatedAt) {
    return urlPrefix + '?filter[updated_at_gt]=' + updatedAt;
  },

  // Check data before it's stored in the database
  check: {
    id: Number,
    name: String,
    updatedAt: Date
  }
});
```

Then call methods:
```js
  fooCache.load(function(err, status) {
    // load is done
  });

  fooCache.sync(function(err, status) {
    // sync is done
  });

  fooCache.loadOne(id, function(err, status) {
    // loadOne is done
  });

```

#### The status collection
`CacheSync.status` collection format:
```js
    _id,
    initialized: false,
    loading: true,
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
```

#### Events
Events:
* `loadCalled` - Emitted when a load is called
* `syncCalled` - Emitted when a sync is called
* `sync` - Emittet when a sync starts
* `synchronized` - Emittet when a collection is synchronized
* `[collection name].synchronized`
* `inserted` - Emittet when a document is inserted
* `updated` - Emittet when a doucment is updated
* `removed` - Emittet when a document is removed
* `loading` - Emittet when load starts
* `loaded` - Emittet when collection has just been fully loaded
* `[collection name].loaded`
* `load` - Emittet on every page load of a collection
* `[collection name].load`
* `initialized` - Called when collection is loaded the first time
* `[collection name].initialized`
* `error` - Emitted on errors
* `waiting` - Emitted if CacheSync is paused and "load" or "sync" can't run
* `paused` - Emitted when sync is paused
* `resumed` - Emitted when sync is resumed

##### Error event
```js
  {
    name: 'collection name',
    type: 'http request',
    message: 'Error message'
  }
```

Error event types:
* `http missing header`
* `http request`
* `http denied`
* `transform`
* `schema`
* `after`
* `load not supported`
* `sync not supported`
* `loadOne not supported`
