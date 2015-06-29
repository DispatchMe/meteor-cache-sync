/* global Events: false, fooCache: false, foo: false */
Tinytest.add('Dispatch cache-sync - test load:1', function(test) {

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'count', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 0
  });
  // FIRST SYNC

  Events.clear();

  fooCache.load(function () {});

  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=0');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 0,
    count: {
      issues: 0,
      removed: 0,
      inserted: 0,
      updated: 0
    }
  });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(0, 100), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 1,
    count: {
      issues: 0,
      removed: 0,
      inserted: 100,
      updated: 0
    }
  });

  test.isFalse(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 0 });
});

Tinytest.add('Dispatch cache-sync - test load:2', function(test) {
  // SECOND SYNC
  Events.clear();

  fooCache.load(function () {});

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized:
    false,
    page: 1,
    count: {
      issues: 0,
      removed: 0,
      inserted: 100,
      updated: 0
    }
  });


  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=100');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 1,
    count: {
      issues: 0,
      removed: 0,
      inserted: 100,
      updated: 0
    }
  });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(100, 200), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 2,
    count: {
      issues: 0,
      removed: 0,
      inserted: 200,
      updated: 0
    }
  });

  test.isFalse(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 1 });
});

Tinytest.add('Dispatch cache-sync - test load:3', function(test) {
  // THIRD SYNC
  Events.clear();

  fooCache.load(function () {});

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 2,
    count: {
      issues: 0,
      removed: 0,
      inserted: 200,
      updated: 0
    }
  });

  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=200');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 2,
    count: {
      issues: 0,
      removed: 0,
      inserted: 200,
      updated: 0
    }
  });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(200, 300), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 3,
    count: {
      issues: 0,
      removed: 0,
      inserted: 300,
      updated: 0
    }
  });

  test.isFalse(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 2 });
});

Tinytest.add('Dispatch cache-sync - test load:4', function(test) {
  // THIRD SYNC
  // This third sync will return only 50 items - since the limit is 100 we assume that the end is reached
  Events.clear();

  fooCache.load(function () {});

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 3,
    count: {
      issues: 0,
      removed: 0,
      inserted: 300,
      updated: 0
    }
  });

  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=300');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);

  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: false,
    page: 3,
    count: {
      issues: 0,
      removed: 0,
      inserted: 300,
      updated: 0
    }
  });


  handle.callback(null, {
    data: {
      foo: _.map(_.range(300, 350), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 0,
      removed: 0,
      inserted: 350,
      updated: 0
    }
  });

  test.isFalse(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isTrue(Events.wasTriggered('initialized'), 'initialized event should be triggered');
  test.isTrue(Events.wasTriggered('loaded'), 'loaded event should be triggered');

  test.isTrue(Events.wasTriggered('test_foo.initialized'), 'initialized event should be triggered');
  test.isTrue(Events.wasTriggered('test_foo.loaded'), 'loaded event should be triggered');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 3 });

  test.equal(foo.find().count(), 350, 'not all items are cached');

  // Check each document data
  var a = 0;
  foo.find().forEach(function(doc) {
    test.equal(doc._id, ''+a);
    test.equal(doc.name, 'foo' + a);

    // Check that the inserted event was triggered pr. document
    if (a >= 300) {
      test.isTrue(Events.wasTriggered('inserted', { name: 'test_foo', id: doc._id }));
    } else {
      test.isFalse(Events.wasTriggered('inserted', { name: 'test_foo', id: doc._id }));
    }
    a++;
  });

});

Tinytest.add('Dispatch cache-sync - test sync:1', function(test) {

  // REGULAR SYNC
  Events.clear();

  fooCache.sync(function () {});

  var handle = HTTP.getHandle();

  var latest = foo.findOne({}, { sort: { updatedAt: -1 } });

  test.equal(handle.url, 'http://test/v1/foo?filter[updated_at_gt]=' +  latest.updatedAt + '&limit=100');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 0,
      removed: 0,
      inserted: 350,
      updated: 0
    }
  });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(0, 10), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 0,
      removed: 0,
      inserted: 350,
      updated: 10
    }
  });

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isTrue(Events.wasTriggered('test_foo.synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');
  test.equal(Events.getState('synchronized'), { name: 'test_foo' });

  test.isFalse(Events.wasTriggered('loading'), 'loading event should not trigger on a sync');

  test.equal(foo.find().count(), 350, 'There should not be more or less since this is a sync');

  foo.find().forEach(function(doc) {
    // Check that the cached event was triggered pr. document
    if (doc._id < 10) {
      test.isTrue(Events.wasTriggered('updated', { name: 'test_foo', id: doc._id }));
    } else {
      test.isFalse(Events.wasTriggered('updated', { name: 'test_foo', id: doc._id }));
    }
  });

});


Tinytest.add('Dispatch cache-sync - check database:1', function(test) {
  // Check that the collection doesn't contain removed data
  // and data is valid
  test.equal(foo.find().count(), 350, 'Document count is different than expected');

  foo.find().forEach(function(doc) {
    test.isTrue(doc._id >= 0, 'document should not exist');

    test.equal(_.omit(doc, 'updatedAt', '_id'), {
      id: +doc._id,
      name: 'foo' + doc._id
    }, 'document did not match schema "' + doc._id + '"');
  });

  _.each(_.range(0, 350), function(i) {
    var doc = foo.findOne({ _id: ''+i });

    test.isTrue(!!doc, 'Document not found "' + i + '"');
  });
});

// Ref: http://vowsjs.org/#reference
//
// test.ok({ message: 'Ok' })
// test.expect_fail()
// test.fail({type: 'foo', expected: '', actual: '', message: ''})
// test.exception(exception)
// test.runId()
// test.equal(actual, expected, message, not)
// test.notEqual(actual, expected, message)
// test.instanceOf(obj, klass, message)
// test.notInstanceOf(obj, klass, message)
// test.matches(actual, regexp, message)
// test.notMatches(actual, regexp, message)
// test.throws(f, expected)
// test.isTrue(v, msg)
// test.isFalse(v, msg)
// test.isNull(v, msg)
// test.isNotNull(v, msg)
// test.isUndefined(v, msg)
// test.isNotUndefined(v, msg)
// test.isNaN(v, msg)
// test.isNotNaN(v, msg)
// test.include(s, v, message, not)
// test.notInclude(s, v, message)
// test.length(obj, expected_length, msg)
// test._stringEqual(actual, expected, message) EXPERIMENTAL
