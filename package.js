Package.describe({
  name: 'dispatch:cache-sync',
  version: '0.0.1',
  summary: 'Cache restpoints into mongodb'
});

Package.onUse(function (api) {
  api.export('CacheSync');

  api.use([
    'mongo',
    'dispatch:logstar@0.0.5'
  ], ['server', 'client']);

  api.use([
    'check',
    'underscore',
    'http',
    'random',
    'raix:eventstate@0.0.2'
  ], 'server');

  api.addFiles('lib/server.js', ['server']);
  api.addFiles('lib/client.js', ['client']);
});

Package.onTest(function(api) {
  api.use([
    'tinytest',
    'http',
    'mongo',
    'underscore',
    'check',
    'dispatch:cache-sync'
  ]);

  api.addFiles([
    'tests/prepare.js',
    'tests/environment.js',
    'tests/test.initial.sync.js'
  ], 'server');
});
