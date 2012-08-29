(function(module) {
    var http        = require("http"),
        FileManager = require("./FileManager");

    function Server(path, redis) {
        var self = this;

        self.redis   = redis;
        self.manager = new FileManager(path, redis);
        self.server  = http.createServer(function(req, res) {
            if (req.method == "PUT") {
                return self.handlePut(req, res);
            }

            if (req.method == "GET") {
                return self.handleGet(req, res);
            }

            res.writeHead(501, {
                "Content-Type": "text/plain"
            });

            res.end("fuck you");
        });
    }

    Server.prototype.getManager = function() {
        return this.manager;
    };

    Server.prototype.listen = function() {
        this.server.listen.apply(this.server, arguments);
    };

    Server.prototype.close = function() {
        this.server.close.apply(this.server, arguments);
    };

    Server.prototype.handlePut = function(req, res) {
        console.log("PUT " + req.url);

        if (!+req.headers['content-length']) {
            res.writeHead(413);
            res.end();
            return;
        }

        this.manager.getFileWriter(req.url.substr(1), +req.headers['content-length'], function(error, writer) {
            if (error) {
                console.log(error);
                res.writeHead(500);
                res.end();
                return;
            }

            req.pipe(writer, {
                end: false
            });

            req.on("end", function() {
                writer.end();
                res.writeHead(201);
                res.end();
            });
        });
    }

    Server.prototype.handleGet = function(req, res) {
        var self = this;

        req.on("end", function() {
            console.log("GET " + req.url);

            self.manager.getFileReader(req.url.substr(1), function(error, reader) {
                if (error) {
                    console.log(error);
                    res.writeHead(500);
                    res.end();
                    return;
                }

                if (!reader) {
                    console.log("404");
                    res.writeHead(404);
                    res.end();
                    return;
                }

                res.writeHead(200, {
                    "Content-length": reader.getSize()
                });
                reader.pipe(res);
            });
        });
    }

    module.exports = Server;
})(module);
