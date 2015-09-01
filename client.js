r http = require('http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs');

http.createServer(function(req, res) {
    var uri = url.parse(req.url).pathname;
    var filename = path.join(process.cwd(), uri);
    path.exists(filename, function(exists) {
            if(!exists) {
                        console.log("not exists: " + filename);
                        res.writeHead(200, {'Content-Type': 'text/plain'});
                        res.write('404 Not Found\n');
                        res.end();
                    }
            var mimeType = mimeTypes[path.extname(filename).split(".")[1]];
            res.writeHead(200, mimeType);
    
            var fileStream = fs.createReadStream(filename);
            fileStream.pipe(res);
    
        }); //end path.exists
}).listen(1337);
