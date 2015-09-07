function Synchronous(io) {
  var self = this;
  this.socket = io();
  this.globalStore = {};
  this.namespaceStore = {};
  this.personalStore = {};
  this.observerCallbackStore = {};

  this.updateHookStore = {};

  this.initPromiseResolve = null;
  this.initPromiseReject = null;
  this.initPromise = new Promise(function (resolve, reject) {
    self.initPromiseResolve = resolve;
    self.initPromiseReject = reject;
  }.bind(this));

  this.socket.on('connect', function() {
    self.connectToPersonalSpace();
  });

  this.createObserver(this.globalStore);

  this.socket.on('value-changed', function(msg) {
    if(msg.room === self.socket.id) {
      self.updateValue(msg.newValue, msg.path, self.personalStore, msg.room);
    } else if (msg.room in self.namespaceStore) {
      // Reset if path is empty
      if(msg.path.length === 0) {
        self.stopObserver(self.namespaceStore[msg.room]);
        self.namespaceStore[msg.room] = msg.newValue;
        self.createObserver(self.namespaceStore[msg.room], null, msg.room);
      } else {
        self.updateValue(msg.newValue, msg.path, self.namespaceStore[msg.room], msg.room);
      }
    } else {
      // Reset if path is empty
      if(msg.path.length === 0) {
        self.stopObserver(self.globalStore);
        self.globalStore = msg.newValue;
        self.createObserver(self.globalStore);

        // resolve promise
        self.initPromiseResolve(self);
      } else {
        self.updateValue(msg.newValue, msg.path, self.globalStore);
      }
    }
  });

  setInterval(function () { console.log('\nGlobalStatus', JSON.stringify(self.globalStore))}, 3000);
  setInterval(function () { console.log('NamespaceStatus', JSON.stringify(self.namespaceStore))}, 3000);
  setInterval(function () { console.log('ClientStore\n', JSON.stringify(self.personalStore))}, 3000);
}

Synchronous.prototype._connectToRoom = function(storeObject, room, data) {
  this.createObserver(storeObject, null, room);
  if(typeof data !== "undefined" || data !== null) {
    for (var property in data) {
      if(data.hasOwnProperty(property)) {
       storeObject[property] = obj[property];
      }
    }
  }
  return storeObject;
}

Synchronous.prototype.createRandomSuffix = function(size)
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i = 0; i < size; ++i) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

Synchronous.prototype.observerCallback = function(objectToWatch, changes, path, room) {
  var self = this;
  changes.forEach(function(change) {
    if(typeof objectToWatch[change.name] === "object" && objectToWatch[change.name] !== null) {
      // Cascade watch of object
      self.createObserver(objectToWatch[change.name], path.concat(change.name));
    }
    console.log('callback', change, path);
    self.socket.emit('value-changed', {path: path.concat(change.name), newValue: objectToWatch[change.name], room: room});
  });
}

Synchronous.prototype.createObserver = function(objectToWatch, path, room) {
  var self = this;
  if(!(objectToWatch.__objectId in this.observerCallbackStore)) {
    if(typeof path === "undefined" || path === null) {
      path = [];
    }

    if(!('__objectId' in objectToWatch)) {
      objectToWatch.__objectId = this.createRandomSuffix(10) + '---' + Date.now() + '---' + path;
    }
    // Add hook registration
    objectToWatch.setHook = function(name, func) {
      if(!(objectToWatch.__objectId in self.updateHookStore)) {
          self.updateHookStore[objectToWatch.__objectId] = {};
      }
      self.updateHookStore[objectToWatch.__objectId][name] = func;
    }

    // Save callback
    var callback = function(changes) {
      self.observerCallback(objectToWatch, changes, path, room);
    }
    this.observerCallbackStore[objectToWatch.__objectId] = callback;

    Object.observe(objectToWatch, callback);
  }
}

Synchronous.prototype.stopObserver = function(objectToWatch) {
  // Find an remove callback
  if(objectToWatch.__objectId in this.observerCallbackStore) {
    Object.unobserve(objectToWatch, this.observerCallbackStore[objectToWatch.__objectId]);
    delete this.observerCallbackStore[objectToWatch.__objectId];
  }
}

Synchronous.prototype.updateValue = function(newValue, path, rootObject, room) {
  var currentObj = rootObject;
  console.log('update', newValue, path, rootObject);

  for(var idx = 0; idx < path.length - 1; idx++) {
    if(typeof currentObj === "undefined" || currentObj === null ) {
      console.error('Cannot resolve update path for', currentObj, '->', path[idx]);
      return;
    }
    currentObj = currentObj[path[idx]];
  }

  this.stopObserver(currentObj);
  var lastName = path.pop();
  // Delte if empty value
  if(typeof newValue === "undefined" || newValue === null) {
    if(currentObj.__objectId in this.updateHookStore) {
      delete this.updateHookStore[currentObj.__objectId];
    }
    delete currentObj[lastName];
  }
  else {
    currentObj[lastName] = newValue;
    // call if update hook is set
    if(currentObj.__objectId in this.updateHookStore && lastName in this.updateHookStore[currentObj.__objectId]
       && typeof this.updateHookStore[currentObj.__objectId][lastName] === "function") {
      this.updateHookStore[currentObj.__objectId][lastName](newValue);
    }
  }
  this.createObserver(currentObj, path, room)

  if(typeof currentObj[lastName] === "object" && currentObj[lastName] !== null) {
    this.createObserver(currentObj[lastName], path.concat(lastName), room);
  }
}

Synchronous.prototype.connectToPersonalSpace = function(data) {
  return this._connectToRoom(this.personalStore, this.socket.id, data);
}

Synchronous.prototype.disconnectFromPersonalSpace = function() {
  this.stopObserver(this.personalStore);
}

Synchronous.prototype.connectToNamespace = function(name, data) {
  if(!(name in this.namespaceStore)) {
    this.socket.emit('connect-to-room', {name: name});
    this.namespaceStore[name] = new Object();
    this._connectToRoom(this.namespaceStore[name], name, data);
  }
  return this.namespaceStore[name];
}

Synchronous.prototype.disconnectFromNamespace = function(name) {
  if(name in this.namespaceStore) {
    this.socket.emit('disconnect-from-room', {name: name});
    this.stopObserver(this.namespaceStore[name]);
  }
}

Synchronous.prototype.clearPersonalSpace = function() {
  this.disconnectFromPersonalSpace()
  this.personalStore = {};
}

Synchronous.prototype.clearNamespace = function(name) {
  if(name in this.namespaceStore) {
    this.disconnectFromNamespace(name);
    delete this.namespaceStore[name];
  }
}

Synchronous.prototype.personalspace = function() {
  return this.personalStore;
}

Synchronous.prototype.namespace = function(name) {
  return this.namespaceStore[name];
}

Synchronous.prototype.globalspace = function() {
  return this.globalStore;
}

Synchronous.prototype.whenInit = function() {
  return this.initPromise;
}
