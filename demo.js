var express = require('express');
var app = express();
var http = require('http').Server(app);
var Sync = require('./index');
var path = require('path');


var dataLayer = new Sync(app, http);

dataLayer.globalspace().users = 0;


function createRandomSuffix(size)
{
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for(var i = 0; i < size; ++i) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.use('/static', express.static('public'));

http.listen(3000, function() {
   console.log('listening on *:3000');

   setInterval(function () { console.log('\nGlobalStatus', JSON.stringify( dataLayer.globalspace() ))}, 3000);
   setInterval(function () { console.log('NamespaceStatus', JSON.stringify( dataLayer.namespace() ))}, 3000);
   setInterval(function () { console.log('ClientStore\n', JSON.stringify( dataLayer.clientspace() ))}, 3000);
});
