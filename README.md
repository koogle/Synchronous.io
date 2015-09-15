# Synchronous.io
Shared JavaScript objects between client and server


### Motivation
Since *node.js* has become a popular backend for all sorts of web applications over the last couple of years developers are getting used to write their frontend and their backend in one language: _JavaScript_.

When we are already using one programming language why do we still have to send all of our app data back and forth between client and server? Let's have *shared objects*. This is what Synchronous.io is for: it allows you to have shared JavaScript objects between backend and frontend. They are synchronized automatically so don't have to care about that.

### Sample

Checkout the contents of the _demo_ folder to see how to setup a simple multi user file edtior in about 50 lines of JavaScript.

_But wait there is more ..._

### Build with Socket.io and ES7

Sychronous.io is build with *io.js* and the awesome work of [Socket.io](http://socket.io/). At it's core it uses the new ES7 [Object.observe()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe) mechanism to recognize and transfer changes to the shared objects.

### Features

### Outlook/Todos

* *Bugfixing*
* ACLs for namespaces and per user basis
* Allow patch changes
* Sent only delta changes
* _Improve performance_

### Contribution

Pull requests are always welcome :)
