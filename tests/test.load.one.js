/* global Events: false, fooCache: false, foo: false */
Tinytest.add('Dispatch cache-sync - test loadOne:1', function(test) {

  // REGULAR SYNC
  Events.clear();

  var id = '20';

  fooCache.loadOne(id, function () {});

  var handle = HTTP.getHandle();

  test.equal(handle.url, 'http://test/v1/foo?filter[id]=' + id);
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 0,
      removed: 10,
      inserted: 350,
      updated: 360
    }
  });

  handle.callback(null, {
    data: {
      foo: [
        { id: id, name: 'foo' + id, updatedAt: new Date(), findOne: true }
      ]
    }
  });


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 0,
      removed: 10,
      inserted: 350,
      updated: 361
    }
  });

  var doc = foo.findOne({ _id: id });

  test.isTrue(doc.findOne, 'Document was not updated');

  test.isTrue(Events.wasTriggered('loadOne'), 'loadOne event was not triggered');
  test.isFalse(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');
  test.isFalse(Events.wasTriggered('loaded'), 'loaded event should not trigger');

  test.equal(Events.getState('loadOne'), { name: 'test_foo', id: id });

  test.isFalse(Events.wasTriggered('loading'), 'loading event should not trigger on a sync');

  test.equal(foo.find().count(), 340, 'There should not be more or less since this is a sync');

  test.isFalse(Events.wasTriggered('inserted'));
  test.isTrue(Events.wasTriggered('updated'));
  test.isFalse(Events.wasTriggered('removed'));

});
