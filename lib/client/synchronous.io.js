function createRandomSuffix(size)
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i = 0; i < size; ++i) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function Synchronous(io) {
  var self = this;
  this._socket = io();
  this._globalStore = {};
  this._globalReadonly = false;
  this._namespaceStore = {};
  this._namespaceReadonly = {};
  this._personalStore = {};
  this._observerCallbackStore = {};

  this._updateHookStore = {};

  this._namespacePromises = {};

  this._initPromiseResolve = null;
  this._initPromiseReject = null;
  this._initPromise = new Promise(function (resolve, reject) {
    self._initPromiseResolve = resolve;
    self._initPromiseReject = reject;
  }.bind(this));

  this._socket.on('connect', function() {
    self.connectToPersonalSpace();
  });

  this._createObserver(this._globalStore);

  this._socket.on('value-changed', function(msg) {
    if(msg.room === self._socket.id) {
      self._updateValue(msg.newValue, msg.path, self._personalStore, msg.room);
    } else if (msg.room in self._namespaceStore) {
      // Reset if path is empty
      if(msg.path.length === 0) {
        self._stopObserver(self._namespaceStore[msg.room]);
        self._namespaceStore[msg.room] = msg.newValue;

        self._createObserver(self._namespaceStore[msg.room], null, msg.room);

        // Set readonly
        self._namespaceReadonly[msg.room] = msg.readonly;

        // resolve promise for room
        if(msg.room in self._namespacePromises) {
          self._namespacePromises[msg.room].promiseResolve({name: msg.room , space: self._namespaceStore[msg.room]});
        }
      } else {
        self._updateValue(msg.newValue, msg.path, self._namespaceStore[msg.room], msg.room);
      }
    } else {
      // Reset if path is empty
      if(msg.path.length === 0) {
        self._stopObserver(self._globalStore);
        self._globalStore = msg.newValue;
        self._createObserver(self._globalStore);

        // Set readonly
        self._globalReadonly = msg.readonly;

        // resolve promise
        self._initPromiseResolve(self);
      } else {
        self._updateValue(msg.newValue, msg.path, self._globalStore);
      }
    }
  });

  this._socket.on('access-change', function(msg) {
    if(msg.room === null) {
      // Parsing readonly
      self._globalReadonly = !!msg.readonly;
    } else {
      if(msg.room in self._namespaceStore) {
        self._namespacePromises[msg.room] = !!msg.readonly;
      }
    }
  });

  setInterval(function () { console.log('\nGlobalStatus', JSON.stringify(self._globalStore))}, 3000);
  setInterval(function () { console.log('NamespaceStatus', JSON.stringify(self._namespaceStore))}, 3000);
  setInterval(function () { console.log('ClientStore\n', JSON.stringify(self._personalStore))}, 3000);
  self.connectToPersonalSpace();
}

Synchronous.prototype._connectToRoom = function(storeObject, room, data) {
//  console.log('connect to room', storeObject, room);
  this._createObserver(storeObject, null, room);
  if(typeof data !== "undefined" || data !== null) {
    for (var property in data) {
      if(data.hasOwnProperty(property)) {
       storeObject[property] = obj[property];
      }
    }
  }
  return storeObject;
}

Synchronous.prototype._observerCallback = function(objectToWatch, changes, path, room) {
  var self = this;

  changes.forEach(function(change) {
    if(typeof objectToWatch[change.name] === "object" && objectToWatch[change.name] !== null) {
      // Cascade watch of object
      // is this overly extensive ???
      self._createObserver(objectToWatch[change.name], path.concat(change.name));
    }

    if(objectToWatch.__objectId in self._updateHookStore && change.name in self._updateHookStore[objectToWatch.__objectId]
       && typeof self._updateHookStore[objectToWatch.__objectId][change.name] === "function") {
      self._updateHookStore[objectToWatch.__objectId][change.name](objectToWatch[change.name]);
    }
    if(objectToWatch === self._personalStore)
      room = self._socket.id;
  //  console.log('observerCallback', room);

    if(!(((typeof room === "undefined" || room === null) && self._globalReadonly) || self._namespaceReadonly[room])) {
      self._socket.emit('value-changed', {path: path.concat(change.name), newValue: objectToWatch[change.name], room: room});
    }

  });
}

Synchronous.prototype._createObserver = function(objectToWatch, path, room) {
  var self = this;
//  console.log('creating object to watch', objectToWatch, room);

  if(!(objectToWatch.__objectId in this._observerCallbackStore)) {
    if(typeof path === "undefined" || path === null) {
      path = [];
    }

    if(!('__objectId' in objectToWatch)) {
      objectToWatch.__objectId = createRandomSuffix(10) + '---' + Date.now() + '---' + path;
    }
    // Add hook registration
    objectToWatch.setHook = function(name, func) {
      if(!(objectToWatch.__objectId in self._updateHookStore)) {
          self._updateHookStore[objectToWatch.__objectId] = {};
      }
      self._updateHookStore[objectToWatch.__objectId][name] = func;
    }

    objectToWatch.unsetHook = function(name) {
      delete self._updateHookStore[objectToWatch.__objectId][name];
      if(self._updateHookStore[objectToWatch.__objectId].length === 0) {
        delete self._updateHookStore[objectToWatch.__objectId];
      }
    }

    // Save callback
    var callback = function(changes) {
      self._observerCallback(objectToWatch, changes, path, room);
    }
    this._observerCallbackStore[objectToWatch.__objectId] = callback;

    Object.observe(objectToWatch, callback);
  }
}

Synchronous.prototype._stopObserver = function(objectToWatch) {
  // Find and remove callback
  if(objectToWatch.__objectId in this._observerCallbackStore) {
    Object.unobserve(objectToWatch, this._observerCallbackStore[objectToWatch.__objectId]);
    delete this._observerCallbackStore[objectToWatch.__objectId];
  }
}

Synchronous.prototype._updateValue = function(newValue, path, rootObject, room) {
  var currentObj = rootObject;
  console.log('update', newValue, path, rootObject, room);

  for(var idx = 0; idx < path.length - 1; idx++) {
    if(typeof currentObj === "undefined" || currentObj === null ) {
      console.error('Cannot resolve update path for', currentObj, '->', path[idx]);
      return;
    }
    currentObj = currentObj[path[idx]];
  }

  this._stopObserver(currentObj);
  var lastName = path.pop();
  // Delte if empty value
  if(typeof newValue === "undefined" || newValue === null) {
    currentObj.unsetHook(lastName);
    delete currentObj[lastName];
  }
  else {
    currentObj[lastName] = newValue;
    // call if update hook is set
    if(currentObj.__objectId in this._updateHookStore && lastName in this._updateHookStore[currentObj.__objectId]
       && typeof this._updateHookStore[currentObj.__objectId][lastName] === "function") {
      this._updateHookStore[currentObj.__objectId][lastName](newValue);
    }
  }
  this._createObserver(currentObj, path, room)

  if(typeof currentObj[lastName] === "object" && currentObj[lastName] !== null) {
    this._createObserver(currentObj[lastName], path.concat(lastName), room);
  }
}

Synchronous.prototype.connectToPersonalSpace = function(data) {
  console.log('personalspace', this._socket.id)
  return this._connectToRoom(this._personalStore, this._socket.id, data);
}

Synchronous.prototype.disconnectFromPersonalSpace = function() {
  this._stopObserver(this._personalStore);
}

Synchronous.prototype.connectToNamespace = function(name, data) {
  if(!(name in this._namespaceStore)) {
    var self = this;

    this._socket.emit('connect-to-room', {name: name});
    this._namespaceStore[name] = new Object();
    this._namespaceReadonly[name] = false;
    this._connectToRoom(this._namespaceStore[name], name, data);

    this._namespacePromises[name] = new Object();
    this._namespacePromises[name].promiseObj = new Promise(function (resolve, reject) {
      self._namespacePromises[name].promiseResolve = resolve;
      self._namespacePromises[name].promiseReject = reject;
    }.bind(this));
  }
  return this._namespacePromises[name].promiseObj;
}

Synchronous.prototype.disconnectFromNamespace = function(name) {

  if(name in this._namespaceStore) {
    this._socket.emit('disconnect-from-room', {name: name});
    this._stopObserver(this._namespaceStore[name]);
    delete this._namespaceReadonly[name];

    if(name in this._namespacePromises) {
        delete this._namespacePromises[name];
    }
  }
}

Synchronous.prototype.clearPersonalSpace = function() {
  this.disconnectFromPersonalSpace()
  this._personalStore = {};
}

Synchronous.prototype.clearNamespace = function(name) {
  if(name in this._namespaceStore) {
    this.disconnectFromNamespace(name);
    delete this._namespaceStore[name];
  }
}

Synchronous.prototype.personalspace = function() {
  return this._personalStore;
}

Synchronous.prototype.namespace = function(name) {
  return this._namespaceStore[name];
}

Synchronous.prototype.globalspace = function() {
  return this._globalStore;
}

Synchronous.prototype.whenInit = function() {
  return this._initPromise;
}
