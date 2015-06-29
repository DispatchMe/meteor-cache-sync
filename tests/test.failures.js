/* global Events: false, fooCache: false, foo: false */
Tinytest.add('Dispatch cache-sync - test failures sync:1', function(test) {

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
      issues: 1,
      removed: 10,
      inserted: 350,
      updated: 371
    }
  });

  var error = new Error('test error');

  error.response = {
    statusCode: 401,
    content: '',
    data: null,
    headers: {
      auth: 'set'
    }
  };

  handle.callback(error);


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 1,
      removed: 10,
      inserted: 350,
      updated: 371
    }
  });

  test.isTrue(Events.wasTriggered('error'), 'the error event should have been triggered');

  test.equal(_.omit(Events.getState('error'), 'url'), {
    name: 'test_foo',
    type: 'http request',
    // url: '',
    headers: {
      auth: 'set'
    },
    message: 'test error',
    response: {
      statusCode: 401,
      content: '',
      data: null,
      headers: {
        auth: 'set'
      }
    }
  });

  test.isFalse(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');
  test.isFalse(Events.wasTriggered('loaded'), 'loaded event should not trigger');
  test.isFalse(Events.wasTriggered('loading'), 'loading event should not trigger on a sync');

  test.isFalse(Events.wasTriggered('inserted'));
  test.isFalse(Events.wasTriggered('updated'));
  test.isFalse(Events.wasTriggered('removed'));

  test.equal(foo.find().count(), 340, 'There should not be more or less since this is a sync');
});
