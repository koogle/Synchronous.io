console.log("Registing new client");

var testBridge  = new Synchronous(io);
var synObj = null;
var currentNamespace = null;

testBridge.whenInit().then(function (syn) {
  synObj = syn;
  syn.globalspace().setHook('users', function(newValue) {
      document.querySelector('h1').innerHTML = newValue + ' users online';
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
