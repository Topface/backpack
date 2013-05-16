(function(module) {
    var http        = require("http"),
        Stats       = require("./Stats"),
        FileManager = require("./FileManager");

    function Server(path, redis) {
        var self = this;

        self.redis   = redis;
        self.stats   = new Stats();
        self.manager = new FileManager(path, redis);
        self.server  = http.createServer(function(req, res) {
            if (req.url == '/stats') {
                res.writeHead(200, {
                    "Content-type": "application/json"
                });

                res.end(JSON.stringify(self.stats.export()));
                return;
            }

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
        var self   = this,
            time   = new Date().getTime(),
            length = +req.headers['content-length'];

        if (!length) {
            res.writeHead(413);
            res.end();
            return;
        }

        self.manager.getFileWriter(req.url.substr(1), length, function(error, writer) {
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
                var now      = new Date().getTime(),
                    duration = now - time;

                writer.end();
                res.writeHead(201);
                res.end();

                self.stats.countPut(duration);

                console.log(now + " PUT " + req.url + " in " + duration);
            });
        });
    }

    Server.prototype.handleGet = function(req, res) {
        var self = this,
            time = new Date().getTime();

        req.on("end", function() {
            self.manager.getFileReader(req.url.substr(1), function(error, reader) {
                if (error) {
                    console.log(error);
                    res.writeHead(500);
                    res.end();
                    return;
                }

                if (!reader) {
                    console.log("returned 404 for " + req.url);
                    res.writeHead(404);
                    res.end();
                    return;
                }

                res.writeHead(200, {
                    "Content-length": reader.getSize()
                });
                reader.pipe(res, {
                    end: false
                });

                reader.on("end", function() {
                    var now      = new Date().getTime(),
                        duration = now - time;

                    res.writeHead(201);
                    res.end();

                    self.stats.countGet(duration);

                    console.log(now + " GET " + req.url + " in " + duration);
                });
            });
        });

        req.resume();
    }

    module.exports = Server;
})(module);
