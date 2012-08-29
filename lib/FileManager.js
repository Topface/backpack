(function(module) {
    var File = require("./File");

    function FileManager(path, redis) {
        var self = this;

        self.path    = path;
        self.redis   = redis;
        self.loading = true;
        self.files   = {};
        self.sizes   = {};

        (function load() {
            self.redis.hgetall("files", function(error, files) {
                if (error) {
                    console.log(error);
                    return;
                }

                self.redis.hgetall("files:sizes", function(error, sizes) {
                    if (error) {
                        console.log(error);
                        return;
                    }

                    if (files) {
                        Object.keys(files).forEach(function(id) {
                            self.files[id] = {
                                file: new File(self.path + "/data_" + id),
                                info: JSON.parse(files[id])
                            };

                            self.sizes[id] = (sizes && sizes[id]) ? +sizes[id] : 0;
                        });
                    }

                    self.loading = false;
                });
            });
        })();

        self.retryAfterLoad = function(method) {
            if (self.loading) {
                return setTimeout(method, 100);
            }

            method();
        };
    }

    FileManager.prototype.serializeImageValue = function(file, offset, length) {
        return file + ":" + offset + ":" + length;

        var result = new Buffer(2 + 4 + 4);

        result.writeUInt16LE(+file, 0);
        result.writeUInt32LE(offset, 2);
        result.writeUInt32LE(length, 2 + 4);

        console.log(result);

        return result;
    };

    FileManager.prototype.unserializeImageValue = function(value) {
        var value  = value.split(":");

        return {
            file   : +value[0],
            offset : +value[1],
            length : +value[2]
        };

        console.log(buf);
        try {
        return {
            file   : buf.readUInt16LE(0),
            offset : buf.readUInt32LE(2),
            length : buf.readUInt32LE(2 + 4)
        };
        } catch(e) {
            console.log(e);
        }
    };

    FileManager.prototype.getFileWriter = function(name, length, callback) {
        var self = this;

        self.retryAfterLoad(function() {
            var sorted = Object.keys(self.files).filter(function(id) {
                return !self.files[id].info.readOnly;
            }).sort(function(left, right) {
                return -(self.sizes[left] - self.sizes[right]);
            });

            if (sorted.length == 0) {
                return callback(new Error("Not found any writable file!"));
            }

            self.files[sorted[0]].file.getWriter(name, length, function(error, writer) {
                if (error) {
                    return callback(error);
                }

                writer.on("close", function() {
                    var id    = sorted[0],
                        value = self.serializeImageValue(id, writer.getOffset(), length);

                    self.redis.set(name, value, function(error) {
                        if (error) {
                            console.log(error);
                        }
                    });

                    self.incrementFileSize(id, length);

                    if (self.sizes[id] > 1024 * 1024 * 3500) {
                        self.files[id].info.readOnly = true;
                        self.updateFileInfo(id);
                    }
                });

                callback(undefined, writer);
            });
        });
    };

    FileManager.prototype.getFileReader = function(file, callback) {
        var self = this;

        self.retryAfterLoad(function() {
            self.redis.get(file, function(error, info) {
                if (error) {
                    return callback(error);
                }

                if (!info) {
                    return callback(new Error("File not found: " + file));
                }

                info = self.unserializeImageValue(info);

                if (!self.files[info.file]) {
                    return callback(new Error("Unknown file for " + file));
                }

                self.files[info.file].file.getReader(info.offset, info.length, function(error, reader) {
                    if (error) {
                        return callback(error);
                    }

                    callback(undefined, reader);
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

                self.sizes[id] = 0;
                self.files[id] = {
                    file: new File(self.path + "/data_" + id),
                    info: {}
                };
                self.updateFileInfo(id);
                self.incrementFileSize(id, 0);

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

    FileManager.prototype.incrementFileSize = function(id, size) {
        var self = this;

        self.retryAfterLoad(function() {
            self.sizes[id] += size;
            self.redis.hincrby("files:sizes", id, size, function(error) {
                if (error) {
                    console.log(error);
                }
            });
        });
    };

    module.exports = FileManager;
})(module);
