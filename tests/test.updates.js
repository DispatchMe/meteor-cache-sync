/* global Events: false, fooCache: false, foo: false */
/* jshint maxlen: 150 */

Tinytest.add('Dispatch cache-sync - test updates sync:1', function(test) {

  // REGULAR SYNC
  Events.clear();

  fooCache.sync(function () {});

  var handle = HTTP.getHandle();

  var latest = foo.findOne({}, { sort: { updatedAt: -1 } });

  test.equal(handle.url, 'http://test/v1/foo?filter[updated_at_gt]=' +  latest.updatedAt + '&limit=100');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt', 'lastLoadedAt'), {
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

  var theseAreNotUpdatedDocuments = _.map(foo.find({
    _id : {
      $in: _.map(_.range(0, 20), function(i) { return ''+i; })
    }
  }).fetch(), function(doc) {
    return _.omit(doc, '_id');
  });

  test.equal(theseAreNotUpdatedDocuments.length, 10, 'Documents not to update count is off');

  handle.callback(null, {
    data: {
      foo: theseAreNotUpdatedDocuments
    }
  });


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt', 'lastLoadedAt'), {
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

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');
  test.isFalse(Events.wasTriggered('loaded'), 'loaded event should not trigger');

  test.equal(Events.getState('synchronized'), { name: 'test_foo' });

  test.isFalse(Events.wasTriggered('loading'), 'loading event should not trigger on a sync');

  test.equal(foo.find().count(), 340, 'There should not be more or less since this is a sync');

  test.isFalse(Events.wasTriggered('inserted'));
  test.isFalse(Events.wasTriggered('updated'));
  test.isFalse(Events.wasTriggered('removed'));

});

/* global Events: false, fooCache: false, foo: false */
Tinytest.add('Dispatch cache-sync - test updates sync:2', function(test) {

  // REGULAR SYNC
  Events.clear();

  fooCache.sync(function () {});

  var handle = HTTP.getHandle();

  var latest = foo.findOne({}, { sort: { updatedAt: -1 } });

  test.equal(handle.url, 'http://test/v1/foo?filter[updated_at_gt]=' +  latest.updatedAt + '&limit=100');
  test.equal(handle.options, { headers: { auth: 'set' } });
  test.instanceOf(handle.callback, Function);
  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt', 'lastLoadedAt'), {
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

  var theseAreUpdatedDocuments = _.map(foo.find({
    _id : {
      $in: _.map(_.range(0, 20), function(i) { return ''+i; })
    }
  }).fetch(), function(doc) {
    doc.updatedAt = new Date();
    return _.omit(doc, '_id');
  });

  test.equal(theseAreUpdatedDocuments.length, 10, 'Documents to update count is off');

  handle.callback(null, {
    data: {
      foo: theseAreUpdatedDocuments
    }
  });


  test.equal(_.omit(CacheSync.getStatus('test_foo' ), 'syncAt', 'createdAt', 'updatedAt', 'loadAt', 'loadedAt', 'lastLoadedAt'), {
    _id: 'test_foo',
    initialized: true,
    page: 0,
    count: {
      issues: 0,
      removed: 10,
      inserted: 350,
      updated: 370
    }
  });


  // Check that the database is actually updated
  _.each(theseAreUpdatedDocuments, function(newDoc) {
    newDoc._id = ''+newDoc.id;

    var oldDoc = foo.findOne({ _id: newDoc._id });

    test.isTrue(!!oldDoc, 'Expected to find a document');

    test.equal(oldDoc.updatedAt - newDoc.updatedAt, 0, 'Date time stamp should match');

    test.equal(newDoc, oldDoc, 'Expected the two documents to match after update');
  });

  test.isTrue(Events.wasTriggered('synchronized'), 'sync event was not triggered');
  test.isFalse(Events.wasTriggered('initialized'), 'initialized event should not trigger');
  test.isFalse(Events.wasTriggered('loaded'), 'loaded event should not trigger');

  test.equal(Events.getState('synchronized'), { name: 'test_foo' });

  test.isFalse(Events.wasTriggered('loading'), 'loading event should not trigger on a sync');

  test.equal(foo.find().count(), 340, 'There should not be more or less since this is a sync');

  test.isFalse(Events.wasTriggered('inserted'));
  test.isTrue(Events.wasTriggered('updated'));
  test.isFalse(Events.wasTriggered('removed'));

});
