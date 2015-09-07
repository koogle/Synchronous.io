/**
* synchronous.io
* A javascript module to allow transient objects between a node server and a client
*
* Idea: Danijar Hafner
* Implementation: Jakob Frick
*/

/**
* Module dependencies.
*/
var socketIOConstructor = require('socket.io');
var path = require('path');

/**
* Module exports.
*/
module.exports = Synchronous;


function createRandomSuffix(size)
{
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for(var i = 0; i < size; ++i) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}


function Synchronous(app, http) {
  var self = this;

  this._io = socketIOConstructor(http);
  this._globalStore = {};
  this._perClientStore = {};
  this._namespaceStore = {};
  this._namespaceClientMapping = {};
  this._observerCallbackStore = {};

  console.log("test", this);
  console.log(this.createObserver);
  this.createObserver(this._globalStore);

  app.get('/synchronous.io/synchronous.io.js', function(req, res) {
    res.sendFile(path.join(__dirname + '/client/synchronous.io.js'));
  });

  this._io.on('connection', function(socket) {
     self._perClientStore[socket.id] = new Object();
     self.createObserver(self._perClientStore[socket.id], null, socket.id);

     self._io.to(socket.id).emit('value-changed', {newValue: self._globalStore, room: null, path: []});

     socket.on('value-changed', function(msg) {
       if(typeof msg.room === "undefined" || msg.room === null) {
         socket.broadcast.emit('value-changed', msg);
         self._updateValue(msg.newValue, msg.path, self._globalStore, msg.room);

       } else {
         socket.broadcast.to(msg.room).emit('value-changed', msg);

         if(msg.room in self._perClientStore) {
           self._updateValue(msg.newValue, msg.path, self._perClientStore[msg.room], msg.room);
         } else {
           // Make sure client is registerd on room
           self._connectToRoom(msg.room, socket.id);
           self._updateValue(msg.newValue, msg.path, self._namespaceStore[msg.room].storeObject, msg.room);
         }
       }
     });

     socket.on('connect-to-room', function(msg) {

       if(typeof msg.name === "undefined" || msg.name === null)
        return;

       self._connectToRoom(msg.name, socket.id);
       socket.join(msg.name);
     });

     socket.on('disconnect-from-room', function(msg) {

       if(typeof msg.name === "undefined" || msg.name === null)
        return;

       var indexOfName = self._namespaceClientMapping[socket.id].indexOf(msg.name);
       if(indexOfName !== -1) {
         self._disconnectFromRoom(msg.name, socket.id);
         self._namespaceClientMapping[socket.id].splice(indexOfName, 1);
         socket.leave(msg.name);
       }

     });

     socket.on('disconnect', function(msg) {
       self._unconnectClient(socket.id);
     });
  });
}

Synchronous.prototype._observerCallback = function(objectToWatch, changes, path, room) {
//  console.info('Changes', JSON.stringify(changes));
  var self = this;
  changes.forEach(function(change) {
    if(typeof objectToWatch[change.name] === "object" && objectToWatch[change.name] !== null) {
      // Cascade watch of object
      self.createObserver(objectToWatch[change.name], path.concat(change.name), room);
    }

    var target;
    if(!(typeof room === "undefined" || room === null)) {
       target = self._io.to(room);
    } else {
       target = self._io.sockets;
    }
    target.emit('value-changed', {path: path.concat(change.name), newValue: objectToWatch[change.name], room: room});
  });
}

Synchronous.prototype.createObserver = function(objectToWatch, path, room) {
  if(!(objectToWatch.__observerId && objectToWatch.__observerId in this._observerCallbackStore)) {
    if(typeof path === "undefined" || path === null) {
      path = [];
    }

    objectToWatch.__observerId = createRandomSuffix(10) + '---' + Date.now() + '---' + path;

    // Save callback
    var self = this;
    var callback = function(changes) {
      self._observerCallback(objectToWatch, changes, path, room);
    }
    this._observerCallbackStore[objectToWatch.__observerId] = callback;

    Object.observe(objectToWatch, callback);
  }
}

Synchronous.prototype.stopObserver = function(objectToWatch) {
  // Find an remove callback
  if(objectToWatch.__observerId in this._observerCallbackStore) {
    Object.unobserve(objectToWatch, this._observerCallbackStore[objectToWatch.__observerId]);
    delete this._observerCallbackStore[objectToWatch.__observerId];
    delete objectToWatch.__observerId;
  }
}

Synchronous.prototype._updateValue = function(newValue, path, rootObject, room) {
  var currentObj = rootObject;

  for(var idx = 0; idx < path.length - 1; idx++) {
    if(typeof currentObj === "undefined" || currentObj === null ) {
      console.error('Cannot resolve update path for', currentObj, '->', path[idx]);
      return;
    }
    currentObj = currentObj[path[idx]];
  }

  var lastName = path.pop();
  this.stopObserver(currentObj);
  if(typeof newValue === "undefined" || newValue === null) {
    delete currentObj[lastName];
  }
  else {
    currentObj[lastName] = newValue;
  }
  this.createObserver(currentObj, path, room)

  if(typeof currentObj[lastName] === "object" && currentObj[lastName] !== null) {
    this.createObserver(currentObj[lastName], path.concat(lastName), room);
  }
}

Synchronous.prototype._connectToRoom = function(name, clientId) {
  if(!(name in this._namespaceStore)) {
    this._namespaceStore[name] = { storeObject: {}, refCount: 0};
    this.createObserver(this._namespaceStore[name].storeObject, null, name);
  }

  if(!(clientId in this._namespaceClientMapping && this._namespaceClientMapping[clientId].indexOf(name) !== -1)) {
    if(!(clientId in this._namespaceClientMapping)) {
        this._namespaceClientMapping[clientId] = [];
    }
    this._namespaceClientMapping[clientId].push(name);
    this._namespaceStore[name].refCount++;

    // Tell client about existing values
    io.to(clientId).emit('value-changed', {newValue: this._namespaceStore[name].storeObject, room: name, path: []});
  }
}

Synchronous.prototype._disconnectFromRoom = function(name, clientId) {
  var namespaceConnectedTo = this._namespaceStore[name];

  namespaceConnectedTo.refCount--;
  if(namespaceConnectedTo.refCount <= 0) {
    this.stopObserver(namespaceConnectedTo.storeObject);
    delete this._namespaceStore[name];
  }
}

Synchronous.prototype._unconnectClient = function(clientId) {
  this.stopObserver(this._perClientStore[clientId]);
  delete this._perClientStore[clientId];

  if(clientId in this._namespaceClientMapping) {
    for(var idx = 0; idx < this._namespaceClientMapping[clientId].length; ++idx) {
      this._disconnectFromRoom(this._namespaceClientMapping[clientId][idx], clientId);
    }

    delete this._namespaceClientMapping[clientId];
  }
}

Synchronous.prototype.clientspace = function(clientId) {
  return this._perClientStore[clientId];
}

Synchronous.prototype.namespace = function(name) {
  return this._namespaceStore[name];
}

Synchronous.prototype.globalspace = function() {
  return this._globalStore;
}
