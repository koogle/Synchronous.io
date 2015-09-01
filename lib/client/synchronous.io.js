var socket = io();
var globalStore = {};
var namespaceStore = {};
var personalStore = {};
var observerCallbackStore = {};

socket.on('connect', function() {
  connectToPersonalSpace();
});

function createRandomSuffix(size)
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for(var i = 0; i < size; ++i) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function observerCallback(objectToWatch, changes, path, room) {
  changes.forEach(function(change) {
    if(typeof objectToWatch[change.name] === "object" && objectToWatch[change.name] !== null) {
      // Cascade watch of object
      createObserver(objectToWatch[change.name], path.concat(change.name));
    }

    socket.emit('value-changed', {path: path.concat(change.name), newValue: objectToWatch[change.name], room: room});
  });
}


function createObserver(objectToWatch, path, room) {
  if(!(objectToWatch.__observerId && objectToWatch.__observerId in observerCallbackStore)) {
    if(typeof path === "undefined" || path === null) {
      path = [];
    }

    objectToWatch.__observerId = createRandomSuffix(10) + '---' + Date.now() + '---' + path;

    // Save callback
    var callback = function(changes) {
      observerCallback(objectToWatch, changes, path, room);
    }
    observerCallbackStore[objectToWatch.__observerId] = callback;

    Object.observe(objectToWatch, callback);
  }
}

function stopObserver(objectToWatch) {
  // Find an remove callback
  if(objectToWatch.__observerId in observerCallbackStore) {
    Object.unobserve(objectToWatch, observerCallbackStore[objectToWatch.__observerId]);
    delete observerCallbackStore[objectToWatch.__observerId];
    delete objectToWatch.__observerId;
  }
}

function updateValue(newValue, path, rootObject, room) {
  var currentObj = rootObject;

  for(var idx = 0; idx < path.length - 1; idx++) {
    if(typeof currentObj === "undefined" || currentObj === null ) {
      console.error('Cannot resolve update path for', currentObj, '->', path[idx]);
      return;
    }
    currentObj = currentObj[path[idx]];
  }

  stopObserver(currentObj);
  var lastName = path.pop();
  currentObj[lastName] = newValue;
  createObserver(currentObj, path, room)

  if(typeof currentObj === "object" && currentObj !== null) {
    createObserver(currentObj, path.concat(lastName), room);
  }
}

createObserver(globalStore);

socket.on('value-changed', function(msg) {
  if(msg.room === socket.id) {
    updateValue(msg.newValue, msg.path, personalStore, msg.room);
  } else if (msg.room in namespaceStore) {
    // Reset if path is empty
    if(msg.path.length === 0) {
      stopObserver(namespaceStore[msg.room]);
      namespaceStore[msg.room] = msg.newValue;
      createObserver(namespaceStore[msg.room], null, msg.room);
    } else {
      updateValue(msg.newValue, msg.path, namespaceStore[msg.room], msg.room);
    }
  } else {

    // Reset if path is empty
    if(msg.path.length === 0) {
      stopObserver(globalStore);
      globalStore = msg.newValue;
      createObserver(globalStore);
    } else {
      updateValue(msg.newValue, msg.path, globalStore);
    }

  }
});

function _connectToRoom(storeObject, room, data) {
  createObserver(storeObject, null, room);
  if(typeof data !== "undefined" || data !== null) {
    for (var property in data) {
      if(data.hasOwnProperty(property)) {
       storeObject[property] = obj[property];
      }
    }
  }
  return storeObject;
}

function connectToPersonalSpace(data) {
  return _connectToRoom(personalStore, socket.id, data);
}

function disconnectFromPersonalSpace() {
  stopObserver(personalStore);
}

function connectToNamespace(name, data) {
  if(!(name in namespaceStore)) {
    socket.emit('connect-to-room', {name: name});
    namespaceStore[name] = new Object();
    _connectToRoom(namespaceStore[name], name, data);
  }
  return namespaceStore[name];
}

function disconnectFromNamespace(name) {
  if(name in namespaceStore) {
    socket.emit('disconnect-from-room', {name: name});
    stopObserver(namespaceStore[name]);
  }
}

function clearPersonalSpace() {
  disconnectFromPersonalSpace()
  personalStore = {};
}

function clearNamespace(name) {
  if(name in namespaceStore) {
    disconnectFromNamespace(name);
    delete namespaceStore[name];
  }
}

function personalspace() {
  return personalStore;
}

function namespace(name) {
  return namespaceStore[name];
}

function globalspace() {
  return globalStore;
}

setInterval(function () { console.log('\nGlobalStatus', JSON.stringify(globalStore))}, 3000);
setInterval(function () { console.log('NamespaceStatus', JSON.stringify(namespaceStore))}, 3000);
setInterval(function () { console.log('ClientStore\n', JSON.stringify(personalStore))}, 3000);
