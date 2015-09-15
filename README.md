# Synchronous.io <img src="https://raw.githubusercontent.com/koogle/Synchronous.io/master/demo/public/icon.png" width="80" alt="Synchronous Logo">
Shared JavaScript objects between client and server


### Motivation
Since **node.js** has become a popular backend for all sorts of web applications over the last couple of years developers are getting used to write their frontend and their backend in one language: _JavaScript_.

When we are already using one programming language why do we still have to send all of our app data back and forth between client and server? Let's have **shared objects**. This is what Synchronous.io is for: it allows you to have shared JavaScript objects between backend and frontend. They are synchronized automatically so don't have to care about that.

### Sample

Checkout the contents of the _demo_ folder to see how to setup a simple multi user file edtior in about 50 lines of JavaScript.

_But wait there is more ..._

### Build with Socket.io and ES7

Sychronous.io is build with **io.js** and the awesome work of [Socket.io](http://socket.io/). At it's core it uses the new ES7 [Object.observe()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe) mechanism to recognize and transfer changes to the shared objects.

```
---------------------------------------------------------------------
|  Client JS       -      Shared space         -   Server JS        |
---------------------------------------------------------------------
|                        Synchronous.io                             |
---------------------------------------------------------------------
|                         Socket.io                                 |
---------------------------------------------------------------------
| Browser JS engine |                           | Node.js           |
---------------------                           ---------------------
| Client            |                           | Server            |
---------------------                           ---------------------

```

### Features

###### Globalspace
Via the `globalspace()` function on server and client side a shared global space for Javascript objects can be accessed.

###### Namespace
Via the `namespace(name)` function on server and client side a shared namespaces can be accessed. Namespace changes are only published to clients subscribed to this namespace. Furhtermore a client is updated when he accesses a namespace. Via reference counting it is determined when a namespace is deleted.

###### Clientspaces
Via the `clientspace(clientId)` function on server side a shared space between the server and a client which is exclusive to the client can be accessed. The counterpart on the client is the `personalspace()` function.

###### Hooks
Via the `setHook(name, function)` and `unsetHook(name)` functions a hook can be set on property of a shared object. This hook is then called as soon as the value of the property changes.
```javascript
synObj.connectToNamespace(newRoomName).then(function (n) {
...

  n.space.setHook('content', function (newContent) {
    document.querySelector('#roomcontent').value = newContent;
  });

...
});
```

###### Readonly
Via the `setNamespaceReadonly(name, readonly, silent)` and `setGlobalspaceReadonly(readonly, silent)` functions the server can make _namespaces_ and the _globalspace_ readonly. Then changes by the clients are not accepted. If `silent` is `true` then the clients are not notifed about the readonly change.


### Requirements

* _node.js_/_io.js_
* [express](https://github.com/strongloop/express)
* [Socket.io](http://socket.io/)

### Outlook/Todos

* **Bugfixing**
* Support other node webservers than _express.js_
* ACLs for namespaces and per user basis
* Allow patch changes
* Sent only delta changes
* _Improve performance_

## TLDR
Server:
```javascript
var sync = new Sync(app, http);
sync.globalspace().testValue = 'Hallo';
```

Client:
```javascript
(new Synchronous(io)).whenInit().then(function (syn) {
  syn.globalspace().testValue += ' World';
}
``` 

Server:
```javascript
  console.log(syn.globalspace().testValue);
>>>'Hallo World'
``` 
Client:
```javascript
  console.log(syn.globalspace().testValue);
>>>'Hallo World'
``` 
(And of course for every furhter client ...)
> Server:
> ```javascript
  console.log(syn.globalspace().testValue);
>>>>'Hallo World World World ...'
``` 
>Client:
>```javascript
  console.log(syn.globalspace().testValue);
>>>>'Hallo World World World ...'
```

### Contribution

Pull requests are always welcome :)
