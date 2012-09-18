(function(module) {
    var File = require("./File");

    function FileManager(path, redis) {
        var self = this;

        self.path    = path;
        self.redis   = redis;
        self.loading = true;
        self.files   = {};

        (function load() {
            self.redis.hgetall("files", function(error, files) {
                if (error) {
                    console.log(error);
                    return;
                }

                if (files) {
                    Object.keys(files).forEach(function(id) {
                        id = id.toString();

                        self.files[id] = {
                            file: new File(self.path + "/data_" + id),
                            info: JSON.parse(files[id].toString())
                        };
                    });
                }

                self.loading = false;

                Object.keys(self.files).forEach(function(id) {
                    self.recheckFileState(id);
                });
            });
        })();

        self.retryAfterLoad = function(method) {
            if (self.loading) {
                return setTimeout(method, 100);
            }

            method();
        };
    };

    FileManager.prototype.setNodeKeySerializer = function(serializer, unserializer) {
        this.nodeKeySerializer   = serializer;
        this.nodeKeyUnserializer = unserializer;
    };

    FileManager.prototype.nodeKeySerializer = function(key, callback) {
        callback(undefined, key);
    };

    FileManager.prototype.nodeKeyUnserializer = function(serialized, callback) {
        return callback(undefined, serialized);
    };

    FileManager.prototype.setNodeInfoSerializer = function(serializer, unserializer) {
        this.nodeInfoSerializer   = serializer;
        this.nodeInfoUnserializer = unserializer;
    };

    FileManager.prototype.nodeInfoSerializer = function(file, offset, length, callback) {
        callback(undefined, file + ":" + offset + ":" + length);
    };

    FileManager.prototype.nodeInfoUnserializer = function(value, callback) {
        var value  = value.toString().split(":");

        callback(undefined, {
            file   : +value[0],
            offset : +value[1],
            length : +value[2]
        });
    };

    FileManager.prototype.getFile = function(id, callback) {
        var self = this;

        self.retryAfterLoad(function() {
            if (!self.files[id]) {
                return callback(new Error("Trying to access unknown file: " + id));
            }

            callback(undefined, self.files[id].file);
        });
    };

    FileManager.prototype.isReadOnlyFile = function(id, callback) {
        var self = this;

        self.retryAfterLoad(function() {
            if (!self.files[id]) {
                return callback(new Error("Trying to access unknown file: " + id));
            }

            callback(undefined, self.files[id].info.readOnly);
        });
    };

    FileManager.prototype.getFileWriter = function(name, length, callback) {
        var self = this;

        self.retryAfterLoad(function() {
            self.nodeKeySerializer(name, function(error, key) {
                if (error) {
                    return callback(error);
                }

                var sorted = Object.keys(self.files).filter(function(id) {
                    return !self.files[id].info.readOnly;
                }).sort(function(left, right) {
                    return -(self.files[left].file.getSize() - self.files[right].file.getSize());
                });

                if (sorted.length == 0) {
                    return callback(new Error("Not found any writable file!"));
                }

                self.files[sorted[0]].file.getWriter(name, length, function(error, writer) {
                    if (error) {
                        return callback(error);
                    }

                    self.nodeInfoSerializer(sorted[0], writer.getOffset(), length, function(error, value) {
                        if (error) {
                            return callback(error);
                        }

                        writer.on("close", function() {
                            self.redis.set(key, value, function(error) {
                                if (error) {
                                    console.log(error);
                                }
                            });

                            self.recheckFileState(sorted[0]);
                        });

                        writer.on("error", function(error) {
                            console.log(error);
                            self.recheckFileState(sorted[0]);
                        });

                        callback(undefined, writer);
                    });
                });
            });
        });
    };

    FileManager.prototype.recheckFileState = function(id) {
        var self = this;

        self.retryAfterLoad(function() {
            var file        = self.files[id],
                wasReadOnly = file.info.readOnly,
                nowReadOnly = file.file.getSize() > 1024 * 1024 * 3500 / 1024;

            if (wasReadOnly != nowReadOnly) {
                file.info.readOnly = nowReadOnly;
                self.updateFileInfo(id);

                console.log("file " + id + " read-only state changed to " + (nowReadOnly ? "true" : "false"));
            }
        });
    };

    FileManager.prototype.getFileReader = function(name, callback) {
        var self = this;

        self.retryAfterLoad(function() {
            self.nodeKeySerializer(name, function(error, key) {
                if (error) {
                    return callback(error);
                }

                self.redis.get(key, function(error, info) {
                    if (error) {
                        return callback(error);
                    }

                    if (!info) {
                        return callback();
                    }

                    self.nodeInfoUnserializer(info, function(error, info) {
                        if (error) {
                            return callback(error);
                        }

                        if (!self.files[info.file]) {
                            return callback(new Error("Unknown file for " + name));
                        }

                        self.files[info.file].file.getReader(info.offset, info.length, function(error, reader) {
                            if (error) {
                                return callback(error);
                            }

                            callback(undefined, reader);
                        });
                    });
                });
            });
        });
    };

    FileManager.prototype.addStorageFile = function(callback) {
        var self = this;

        self.retryAfterLoad(function() {
            self.redis.incr("files_counter", function(error, id) {
                if (error) {
                    return callback(error);
                }

                self.files[id] = {
                    file: new File(self.path + "/data_" + id),
                    info: {}
                };
                self.updateFileInfo(id);

                callback(undefined, id);
            });
        });
    };

    FileManager.prototype.updateFileInfo = function(id) {
        var self = this;

        self.retryAfterLoad(function() {
            var value = JSON.stringify(self.files[id].info);

            self.redis.hset("files", id, value, function(error) {
                if (error) {
                    console.log(error);
                }
            });
        });
    };

    FileManager.prototype.getFiles = function(callback) {
        var self = this;

        self.retryAfterLoad(function() {
            callback(undefined, self.files);
        });
    };

    module.exports = FileManager;
})(module);
