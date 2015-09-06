console.log("Registing new client");

var testBridge  = new Synchronous(io);
testBridge.whenInit().then(function (syn) {
  syn.globalspace().users++;
});
