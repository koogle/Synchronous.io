console.log("Registing new client");
var synObj;
var currentNamespace = null;

(new Synchronous(io)).whenInit().then(function (syn) {
  synObj = syn;
  syn.globalspace().setHook('users', function(newValue) {
      document.querySelector('#userspace').innerHTML = newValue + ' user(s) online';
  });

  syn.globalspace().users++;

  window.onbeforeunload = function () {
    syn.globalspace().users--;
  }
});

function changeRoom() {
  if(synObj === null)
    return;

  if(currentNamespace !== null) {
    synObj.disconnectFromNamespace(currentNamespace.name)
    currentNamespace.space.unsetHook('content');
    currentNamespace = null;
  }

  var newRoomName = document.querySelector('#roomnameinput').value;
  if(newRoomName !== null && newRoomName.length > 0) {
    synObj.connectToNamespace(newRoomName).then(function (n) {
      console.log('namespace', n);
      document.querySelector('#roomcontent').value = n.space.content;
      n.space.setHook('content', function (newContent) {
        document.querySelector('#roomcontent').value = newContent;
      });

      currentNamespace = n;
      document.querySelector('#roomspace').innerHTML = n.name;
    });
  }
}

function updateContent() {
  if(synObj === null)
    return;

  var newRoomName = document.querySelector('#roomnameinput').value;
  if(newRoomName !== null && newRoomName.length > 0) {
    synObj.namespace(newRoomName).content = document.querySelector('#roomcontent').value;
  }
}
