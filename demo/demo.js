var express = require('express');
var app = express();
var http = require('http').Server(app);
var Sync = require('./../index');
var path = require('path');

var dataLayer = new Sync(app, http);

dataLayer.globalspace().setHook('users', function (newValue) {
  console.info('Logged in users:', newValue);
});

Object.observe(dataLayer.allNamespaces(), function (changes) {
  changes.forEach(function (change) {
    if(change.type === 'add') {
      dataLayer.namespace(change.name).content = '';
    }
  });
});

dataLayer.globalspace().users = 0;




app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/demo.html'));
});

app.use('/static', express.static(path.join(__dirname + '/public/')));

http.listen(3000, function() {
   console.log('listening on *:3000');

   setInterval(function () { console.log('\n--------------------\n\nGlobalStatus', JSON.stringify( dataLayer.globalspace() ))}, 10000);
   setInterval(function () { console.log('NamespaceStatus', JSON.stringify( dataLayer.allNamespaces() ))}, 10000);
   setInterval(function () { console.log('ClientStore\n', JSON.stringify( dataLayer.allClientspaces() ))}, 10000);
});
