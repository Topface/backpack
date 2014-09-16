(function(module) {
    var http        = require("http"),
        Stats       = require("./Stats");

    /**
     * Server to interact with external world via http.
     *
     * @param {FileManager} manager File manager to work with, should be ready
     * @constructor
     */
    function Server(manager) {
        this.manager = manager;
        this.stats   = new Stats();
    }

    /**
     * Return http server that is already set up to handle requests.
     * Only for internal usage, don't pass this somewhere outside.
     *
     * @returns {http.Server}
     */
    Server.prototype.getServer = function() {
        var self = this;

        if (!self.server) {
            self.server  = http.createServer(function(req, res) {
                var started = new Date(),
                    now, duration;

                if (req.method == "PUT") {
                    self.handlePut(req, res, logPutRequest);
                } else if (req.method == "GET") {
                    if (req.url == '/stats') {
                        self.handleStats(res, logRequest);
                    } else {
                        self.handleGet(req, res, logGetRequest);
                    }
                } else {
                    res.writeHead(418, {
                        "Content-Type": "text/plain"
                    });

                    res.end("I am teapot, what did you expect?\n");
                    logRequest(undefined, 418);
                }

                function logGetRequest(error, status, size) {
                    var duration = logRequest(error, status, size);

                    if (!error && status == 200) {
                        self.stats.countGet(size, duration);
                    }
                }

                function logPutRequest(error, status, size) {
                    var duration = logRequest(error, status, size);

                    if (!error && status == 201) {
                        self.stats.countPut(size, duration);
                    }
                }

                function logRequest(error, status, size) {
                    now      = new Date();
                    duration = now.getTime() - started;

                    if (error) {
                        self.error(now, error, duration);
                    } else {
                        self.log(now, status, size, req.method, req.url, duration);
                    }

                    return duration;
                }
            });
        }

        return self.server;
    };

    /**
     * Start listening for http requests, args just passed to http.Server.
     */
    Server.prototype.listen = function() {
        var server = this.getServer();
        server.listen.apply(server, arguments);
    };

    /**
     * Stop listening for http requests, args just passed to http.Server.
     */
    Server.prototype.close = function() {
        var server = this.getServer();
        server.close.apply(server, arguments);
    };

    /**
     * Log request data.
     *
     * @param {Date} time Current time
     * @param {Number} status Http status code for response
     * @param {Number|undefined} size Size of processed data if appliable
     * @param {String} method Http method of request
     * @param {String} url Url of the request
     * @param {Number} duration Request processing time in milliseconds
     */
    Server.prototype.log = function(time, status, size, method, url, duration) {
        if (!size) {
            size = '???';
        }

        time     = time.toString();
        duration = duration + "ms";
        url      = '"' + url + '"';

        console.log("INFO", [time, process.memoryUsage().rss, status, size, method, url].join(" ") + ' in ' + duration);
    };

    /**
     * Log occurred non-fatal error.
     *
     * @param {Date} time Current time
     * @param {Error} error Error object to log
     * @param {Number} duration Request processing time in milliseconds
     */
    Server.prototype.error = function(time, error, duration) {
        console.log("ERROR", time.toString() + " after " + duration + "ms " + error, error.stack);
    };

    /**
     * Process put request to save data.
     *
     * @param {http.IncomingMessage} req Incoming http request
     * @param {http.ServerResponse} res Http response object
     * @param {Function} callback Callback to call on response finish
     */
    Server.prototype.handlePut = function(req, res, callback) {
        var self       = this,
            length     = +req.headers['content-length'],
            registered = false,
            indexed    = false;

        if (!length) {
            res.writeHead(411);
            res.end();

            callback(undefined, 411);

            return;
        }

        self.manager.getFileWriter(req.url.substr(1), length, function(error, writer) {
            if (error) {
                res.writeHead(500);
                res.end();

                callback(error);

                return;
            }

            req.pipe(writer, {
                end: false
            });

            req.on("end", function() {
                writer.on("registered", function() {
                    registered = true;
                    finishPut();
                });

                writer.on("indexed", function() {
                    indexed = true;
                    finishPut();
                });

                function finishPut() {
                    if (!registered || !indexed) {
                        return;
                    }

                    res.writeHead(201);
                    res.end();

                    callback(undefined, 201, writer.length);
                }

                writer.end();
            });
        });
    };

    /**
     * Process stats request and return json in response.
     *
     * @param {http.ServerResponse} res Http response object
     * @param {Function} callback Callback to call on response finish
     */
    Server.prototype.handleStats = function(res, callback) {
        res.writeHead(200, {
            "Content-type": "application/json"
        });

        res.end(JSON.stringify(this.stats.stats) + "\n");

        callback(undefined, 200);
    };

    /**
     * Process get request and return data.
     *
     * @param {http.IncomingMessage} req Incoming http request
     * @param {http.ServerResponse} res Http response object
     * @param {Function} callback Callback to call on response finish
     */
    Server.prototype.handleGet = function(req, res, callback) {
        var self = this;

        self.manager.getFileReader(req.url.substr(1), function(error, reader) {
            if (error) {
                res.writeHead(500);
                res.end();

                callback(error);

                return;
            }

            if (!reader) {
                res.writeHead(404);
                res.end();

                callback(undefined, 404);

                return;
            }

            res.writeHead(200, {
                "Content-length": reader.length
            });

            reader.pipe(res, {
                end: false
            });

            reader.on("end", function() {
                res.end();

                callback(undefined, 200, reader.length);
            });
        });
    };

    module.exports = Server;
})(module);
