var getStatus = function() {
  return CacheSync.status.findOne({ _id: 'test_foo' });
};

Tinytest.add('Dispatch cache-sync - test sync', function(test) {

  test.isUndefined(getStatus());

  // FIRST SYNC

  Events.clear();

  fooCache.sync(function (err) {
    if (err) { }
  });

  handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=0');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.isUndefined(getStatus());

  handle.callback(null, {
    data: {
      foo: _.map(_.range(0, 100), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });

  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 1 });
  console.log(getStatus());

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.equal(Events.getState('synchronized'), { name: 'test_foo' });
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 0 });

  // SECOND SYNC
  Events.clear();

  fooCache.sync(function (err) {
    if (err) { }
  });

  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 1 });


  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=100');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function)

  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 1 });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(100, 200), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });

  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 2 });

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.equal(Events.getState('synchronized'), { name: 'test_foo' });
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 1 });

  // THIRD SYNC
  Events.clear();

  fooCache.sync(function (err) {
    if (err) { }
  });

  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 2 });

  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=200');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 2 });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(200, 300), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });


  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 3 });

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.equal(Events.getState('synchronized'), { name: 'test_foo' });
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 2 });

  // THIRD SYNC
  // This third sync will return only 50 items - since the limit is 100 we assume that the end is reached
  Events.clear();

  fooCache.sync(function (err) {
    if (err) { }
  });

  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 3 });

  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?sort=id+desc&limit=100&offset=300');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: true, initialized: false, page: 3 });


  handle.callback(null, {
    data: {
      foo: _.map(_.range(300, 350), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });


  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: false, initialized: true, page: 3 });

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.equal(Events.getState('synchronized'), { name: 'test_foo' });
  test.isTrue(Events.wasTriggered('initialized'), 'initialized event should be triggered');

  test.isTrue(Events.wasTriggered('loading'), 'loading event was not triggered');
  test.equal(Events.getState('loading'), { name: 'test_foo', page: 3 });

  test.equal(foo.find().count(), 350, 'not all items are cached');

  // Check each document data
  var a = 0;
  foo.find().forEach(function(doc) {
    test.equal(doc._id, ''+a);
    test.equal(doc.name, 'foo' + a);

    // Check that the cached event was triggered pr. document
    if (a >= 300) {
      test.isTrue(Events.wasTriggered('cached', { name: 'test_foo', id: doc._id }));
      test.isTrue(Events.wasTriggered('insert', { name: 'test_foo', id: doc._id }));
    } else {
      test.isFalse(Events.wasTriggered('cached', { name: 'test_foo', id: doc._id }));
      test.isFalse(Events.wasTriggered('insert', { name: 'test_foo', id: doc._id }));
    }
    a++;
  });


  // REGULAR SYNC
  Events.clear();

  fooCache.sync(function (err) {
    if (err) { }
  });

  var handle = HTTP.getHandle();

  var latest = foo.findOne({}, { sort: { updatedAt: -1 } });

  test.equal(handle.url, 'http://test/v1/foo?filter[updated_at_gt]=' +  latest.updatedAt);
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: false, initialized: true, page: 3 });

  handle.callback(null, {
    data: {
      foo: _.map(_.range(0, 10), function (i) {
        return { id: i, name: 'foo' + i, updatedAt: new Date() };
      })
    }
  });


  test.equal(_.omit(getStatus(), 'syncAt', 'createdAt', 'updatedAt', 'count'), { _id: 'test_foo', loading: false, initialized: true, page: 3 });
  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');
  test.equal(Events.getState('synchronized'), { name: 'test_foo' });

  test.isFalse(Events.wasTriggered('loading'), 'loading event should not trigger on a sync');

  test.equal(foo.find().count(), 350, 'There should not be more or less since this is a sync');

  foo.find().forEach(function(doc) {
    // Check that the cached event was triggered pr. document
    if (doc._id < 10) {
      test.isTrue(Events.wasTriggered('cached', { name: 'test_foo', id: doc._id }));
      test.isTrue(Events.wasTriggered('update', { name: 'test_foo', id: doc._id }));
    } else {
      test.isFalse(Events.wasTriggered('cached', { name: 'test_foo', id: doc._id }));
      test.isFalse(Events.wasTriggered('update', { name: 'test_foo', id: doc._id }));
    }
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
