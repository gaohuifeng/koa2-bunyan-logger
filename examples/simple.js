var koa = require('koa');
var koaBunyanLogger = require('../');

var app = new koa();

app.use(koaBunyanLogger());

app.use(async function () {
  this.log.info('Got a request from %s for %s', this.request.ip, this.path);
  this.body = 'Hello world\r\n';
});

app.listen(8000);
