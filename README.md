# koa2-bunyan-logger

```js
var koa = require('koa');
var koaBunyanLogger = require('koa2-bunyan-logger');

var app = new koa();
app.use(koaBunyanLogger());

app.use(function async (next) {
  this.log.info('Got a request from %s for %s', this.request.ip, this.path);
  await next();
});

app.listen(8000);
```

Server:
```
node --harmony examples/simple.js | ./node_modules/.bin/bunyan -o short`
```

Client:
```
curl http://localhost:8000/
```

Server output:
```
07:50:14.014Z  INFO koa: Got a request from ::1 for /
```

### Request logging

```js
app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext());
app.use(koaBunyanLogger.requestLogger());
```

Server:
```
node --harmony examples/requests.js | ./node_modules/.bin/bunyan -o short
```

Client:
```
curl -H "X-Request-Id: 1234" http://localhost:8000/
```

Server output:
```
20:19:24.526Z  INFO koa:   --> GET / (req_id=1234)
    GET / HTTP/1.1
    --
    req.header: {
      "user-agent": "curl/7.30.0",
      "host": "localhost:8000",
      "accept": "*/*",
      "x-request-id": "1234"
    }
20:19:24.527Z  INFO koa:   <-- GET / 1ms (req_id=1234, duration=1, res.status=200, res.message=OK)
    GET / HTTP/1.1
    --
    x-powered-by: koa
    content-type: text/plain; charset=utf-8
    content-length: 11
    --
    req.header: {
      "user-agent": "curl/7.30.0",
      "host": "localhost:8000",
      "accept": "*/*",
      "x-request-id": "1234"
    }
```

### Suppressing default error stack traces

To ensure that stack traces from request handling don't get logged in their
raw non-JSON forms, you can disable the app's default error handler:

```js
app.on('error', function () {});
```

## API Reference

### koaBunyanLogger(logger)

Parameters:
- logger: bunyan logger instance or an object to pass to bunyan.createLogger()

#### Examples

Use an existing logger:

```js
var bunyan = require('bunyan');
var koaBunyanLogger = require('koa-bunyan-logger');

var appLogger = bunyan.createLogger({
  name: 'myapp',
  level: 'debug',
  serializers: bunyan.stdSerializers
});

app.use(koaBunyanLogger(appLogger));
```

Shortcut to create a new logger:

```js
var koaBunyanLogger = require('koa-bunyan-logger');

app.use(koaBunyanLogger({
  name: 'myapp',
  level: 'debug'
}));
```

### koaBunyanLogger.requestLogger(opts)

Options:
- durationField: Name of field to store request duration in ms

- levelFn: Function which will be called with (status, err) and should
  return the name of a log level to be used for the response log entry.
  The default function will log status 400-499 as warn, 500+ as error,
  and all other responses as info.

- updateLogFields: Function which will be called with a single argument,
  an object containing the fields (req, res, err) to be logged with the
  request and response message.

  The function has the opportunity to add or remove fields from the object,
  or return a different object to replace the default set of fields.
  The function will be called using the koa 'this' context, once for the
  request and again for the response.

- updateRequestLogFields: Function which will be called with a request
  fields object when logging a request, after processing updateLogFields.

- updateResponseLogFields: Function which will be called with a response
  fields object when logging a response, after processing updateLogFields.
  It also receives a second argument, err, if an error was thrown.

- formatRequestMessage: Function which will be called to generate a log message
  for logging requests. The function will be called in the context of the
  koa 'this' context and passed the request fields object. It should return
  a string.

- formatResponseMessage: Same as formatRequestLog, but for responses.

#### Examples

Basic usage:

```js
app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestLogger());
```

Add custom fields to include in request and response logs:

```js
app.use(koaBunyanLogger.requestLogger({
  // Custom fields for both request and response
  updateLogFields: function (fields) {
    fields.authorized_user = this.user.id;
    fields.client_version = this.request.get('X-Client-Version');
  },

  // Custom fields for response only
  updateResponseLogFields: function (fields, err) {
    if (err) {
      fields.last_db_query = this.db.lastDbQuery();
    }
  }
}));
```

### koaBunyanLogger.requestIdContext(opts)

Get X-Request-Id header, or if the header does not exist, generates a random
unique id for each request.

Options:
- header: name of header to get request id from
- prop: property to store on context; defaults to 'reqId' e.g. this.reqId
- requestProp: property to store on request; defaults to 'reqId' e.g. this.request.reqId
- field: field to add to log messages in downstream middleware and handlers;
  defaults to 'req_id'

#### Examples

```js
var koaBunyanLogger = require('koa-bunyan-logger');

app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext());
```

Or use a different header:

```js
var koaBunyanLogger = require('koa-bunyan-logger');

app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext({
  header: 'Request-Id'
}));
```

By default, the request id will be accessible as this.reqId and this.request.reqId:

```js
var koaBunyanLogger = require('koa-bunyan-logger');

app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext());

app.use(function * () {
  this.response.set('X-Server-Request-Id', this.reqId);
  this.body = "Hello world";
});
```

### koaBunyanLogger.timeContext(opts)

Adds `time(label)` and `timeEnd(label)` methods to the koa
context, which records the time between the time() and
timeEnd() calls for a given label.

Calls to time() and timeEnd() can be nested or interleaved
as long as they're balanced for each label.

Options:
- logLevel: name of log level to use; defaults to 'trace'
- updateLogFields: function which will be called with
    arguments (fields) in koa context; can update fields or
    return a new object.

#### Examples

```js
var koaBunyanLogger = require('koa-bunyan-logger');

app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext());
app.use(koaBunyanLogger.timeContext());

app.use(function * () {
  this.time('get data');
  var user = yield getUser();
  var friends = yield getFriend(user);
  this.timeEnd('get data');

  this.time('serialize');
  this.body = serialize(user, friends);
  this.timeEnd('serialize');
});
```

Example output:
```json
{"name":"koa","hostname":"localhost","pid":9228,"level":10,"label":"get data","duration":102,"msg":"","time":"2014-11-07T01:45:53.711Z","v":0}
{"name":"koa","hostname":"localhost","pid":9228,"level":10,"label":"serialize","duration":401,"msg":"","time":"2014-11-07T01:45:54.116Z","v":0}
```

To return different fields, such as nesting the data under
a single field, add a `updateLogFields` function to the options:

```js
var koaBunyanLogger = require('koa-bunyan-logger');

app.use(koaBunyanLogger());
app.use(koaBunyanLogger.requestIdContext());
app.use(koaBunyanLogger.timeContext({
  updateLogFields: function (fields) {
    return {
      request_trace: {
        name: fields.label,
        time: fields.duration
      }
    };
  }
}));
```

### bunyan export

The internal copy of bunyan is exported as `.bunyan`:

```js
var koaBunyanLogger = require('koa-bunyan-logger');
var bunyan = koaBunyanLogger.bunyan;
```
