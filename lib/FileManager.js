(function(module) {
    var File = require("./File");

    /**
     * File manager is the core of backpack, it decides where to put
     * files and where to read them from.
     *
     * @param {String} path Data dir path
     * @param {redis} redis Redis server instance to store data
     * @constructor
     */
    function FileManager(path, redis) {
        this.path    = path;
        this.redis   = redis;
        this.loading = false;
        this.ready   = false;
        this.files   = undefined;
    }

    /**
     * Load all necessary data from redis to start working.
     * If "ready" property is true, this should not be called.
     * If "loading" property is true, loading is progress already.
     *
     * @param {Function} callback Callback to call after load
     */
    FileManager.prototype.load = function(callback) {
        var self = this;

        if (self.loading || self.ready) {
            return;
        }

        if (!self.redis.options.return_buffers) {
            callback(new Error("For safety reasons you should set return_buffers for redis"));
            return;
        }

        self.loading = true;

        self.redis.hgetall("files", function(error, files) {
            if (error) {
                callback(error);
                return;
            }

            self.files = {};

            if (!files) {
                self.loading = false;
                self.ready   = true;
                callback();
                return;
            }

            var ids = Object.keys(files);

            ids.forEach(function(id) {
                id = id.toString();

                self.files[id] = {
                    file: new File(self.path + "/data_" + id),
                    info: JSON.parse(files[id].toString())
                };
            });

            var remaining = ids.length,
                returned  = false;

            ids.forEach(function(id) {
                self.recheckFileState(id, function(error) {
                    if (returned) {
                        return;
                    }

                    if (error) {
                        returned  = true;
                        remaining = false;
                        callback(error);
                        return;
                    }

                    if (--remaining == 0) {
                        returned     = true;
                        self.loading = false;
                        self.ready   = true;
                        callback();
                    }
                });
            });
        });
    };

    /**
     * Set custom key serializer to save some memory in redis.
     *
     * @param {Function} serializer Serializer that receives key and returns serialized key in callback
     * @param {Function} unserializer Unserializer that receives serialized key adn returns key in callback
     */
    FileManager.prototype.setKeySerializer = function(serializer, unserializer) {
        this.keySerializer   = serializer;
        this.keyUnserializer = unserializer;
    };

    /**
     * Serialize key to save some space. Does nothing by default.
     *
     * @param {String|Buffer} key Key for some data
     * @param {Function} callback Callback to receive serialized key
     */
    FileManager.prototype.keySerializer = function(key, callback) {
        if (key == "files" || key == "files_counter") {
            callback(new Error("Sorry, reserved word"));
            return;
        }

        callback(undefined, key);
    };

    /**
     * Unserialize key to restore original name. Does nothing by default.
     *
     * @param {String|Buffer} serialized Serialized key
     * @param {Function} callback Callback to receive original key
     */
    FileManager.prototype.keyUnserializer = function(serialized, callback) {
        if (serialized == "files" || serialized == "files_counter") {
            callback(new Error("Sorry, reserved word"));
            return;
        }

        callback(undefined, serialized);
    };

    /**
     * Set custom value serializer to save some memory in redis.
     *
     * @param {Function} serializer Serializer that receives value and returns serialized value in callback
     * @param {Function} unserializer Unserializer that receives serialized value adn returns value in callback
     */
    FileManager.prototype.setValueSerializer = function(serializer, unserializer) {
        this.valueSerializer   = serializer;
        this.valueUnserializer = unserializer;
    };

    /**
     * Serialize value to save some space.
     *
     * @param {Number} file Data file id
     * @param {Number} offset Offset in data file in bytes
     * @param {Number} length Length of saved data in bytes
     * @param {Function} callback Callback to receive serialized value
     */
    FileManager.prototype.valueSerializer = function(file, offset, length, callback) {
        callback(undefined, file + ":" + offset + ":" + length);
    };

    /**
     * Unserialize value to restore file id, offset and length.
     *
     * @param {String|Buffer} serialized Serialized value
     * @param {Function} callback Callback to receive original value
     */
    FileManager.prototype.valueUnserializer = function(serialized, callback) {
        var value = serialized.toString().split(":");

        callback(undefined, {
            file   : +value[0],
            offset : +value[1],
            length : +value[2]
        });
    };

    /**
     * Get data file object by identifier.
     *
     * @param {Number} id Data file identifier
     * @param {Function} callback Callback to receive data file object
     */
    FileManager.prototype.getFile = function(id, callback) {
        if (!this.ready) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        if (!this.files[id]) {
            callback(new Error("Trying to access unknown file: " + id));
            return;
        }

        callback(undefined, this.files[id].file);
    };

    /**
     * Return writable stream in callback to write data.
     *
     * @param {String} name Data key
     * @param {Number} length Length of incoming data
     * @param {Function} callback Callback to receive writer
     */
    FileManager.prototype.getFileWriter = function(name, length, callback) {
        var self = this;

        if (!self.ready) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        self.keySerializer(name, function(error, key) {
            if (error) {
                callback(error);
                return;
            }

            var sorted = Object.keys(self.files).filter(function(id) {
                return !self.files[id].info.readOnly;
            }).sort(function(left, right) {
                return -(self.files[left].file.offset - self.files[right].file.offset);
            });

            if (sorted.length == 0) {
                callback(new Error("Not found any writable file!"));
                return;
            }

            self.files[sorted[0]].file.getWriter(name, length, function(error, writer) {
                if (error) {
                    callback(error);
                    return;
                }

                self.valueSerializer(sorted[0], writer.offset, length, function(error, value) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    writer.on("finish", function() {
                        self.redis.set(key, value, function(error) {
                            if (error) {
                                writer.emit("error", error);
                            } else {
                                self.recheckFileState(sorted[0], function() {
                                    if (error) {
                                        writer.emit("error", error);
                                    } else {
                                        writer.emit("registered");
                                    }
                                });
                            }
                        });
                    });

                    callback(undefined, writer);
                });
            });
        });
    };

    /**
     * Recheck file "read-only" state and update if needed
     * @param {Number} id Data file identifier
     * @param {Function} callback Callback to call on finish
     */
    FileManager.prototype.recheckFileState = function(id, callback) {
        var file, wasReadOnly, nowReadOnly;

        if (!this.ready && !this.files) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        file        = this.files[id];
        wasReadOnly = file.info.readOnly;
        nowReadOnly = file.file.offset > 1024 * 1024 * 3500;

        if (wasReadOnly != nowReadOnly) {
            file.info.readOnly = nowReadOnly;
            this.updateFileInfo(id, callback);
        } else {
            callback();
        }
    };

    /**
     * Return readable stream for data specified by name.
     * Callback will receive undefined if data not found by name.
     *
     * @param {String} name Name used when data has been saved
     * @param {Function} callback Callback to receive reader
     */
    FileManager.prototype.getFileReader = function(name, callback) {
        var self = this;

        if (!self.ready) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        self.keySerializer(name, function(error, key) {
            if (error) {
                callback(error);
                return;
            }

            self.redis.get(key, function(error, info) {
                if (error) {
                    callback(error);
                    return;
                }

                if (!info) {
                    callback();
                    return;
                }

                self.valueUnserializer(info, function(error, info) {
                    if (error) {
                        callback(error);
                        return;
                    }

                    if (!self.files[info.file]) {
                        callback(new Error("Unknown file for " + name));
                        return;
                    }

                    self.files[info.file].file.getReader(info.offset, info.length, callback);
                });
            });
        });
    };

    /**
     * Extend storage with one file that is ~3.5gb of size.
     *
     * @param {Function} callback Callback to call on finish
     */
    FileManager.prototype.addStorageFile = function(callback) {
        var self = this;

        if (!self.ready) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        self.redis.incr("files_counter", function(error, id) {
            if (error) {
                callback(error);
                return;
            }

            self.files[id] = {
                file: new File(self.path + "/data_" + id),
                info: {}
            };

            self.updateFileInfo(id, function(error) {
                if (error) {
                    callback(error);
                    return;
                }

                callback(undefined, id);
            });
        });
    };

    /**
     * Update file info in redis to sync with internal state.
     *
     * @param {Number} id Data file identifier
     * @param {Function} callback Callback to call on finish
     */
    FileManager.prototype.updateFileInfo = function(id, callback) {
        if (!this.ready && !this.files) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        this.redis.hset("files", id, JSON.stringify(this.files[id].info), callback);
    };

    /**
     * Return data files into callback.
     *
     * @param {Function} callback Callback to receive array of files
     */
    FileManager.prototype.getFiles = function(callback) {
        if (!this.ready) {
            callback(new Error("Trying to access file manager that is not ready"));
            return;
        }

        callback(undefined, this.files);
    };

    module.exports = FileManager;
})(module);
