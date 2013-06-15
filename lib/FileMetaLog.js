(function(module) {
    var fs = require("fs");

    /**
     * Create metadata log for specified data file.
     * Metadata file will be opened synchronously.
     *
     * @param {String} path Path for data file
     * @constructor
     */
    function FileMetaLog(path) {
        var self = this;

        self.path     = path;
        self.closed   = false;
        self.file     = fs.openSync(self.path + ".meta", "a");
    }

    /**
     * Register data by name in meta log with specified offset and length.
     *
     * @param {String} name Name for data to read it later
     * @param {Number} offset Offset in data file in bytes
     * @param {Number} length Length of data in bytes
     * @param {Function} callback Callback to call on finish
     */
    FileMetaLog.prototype.register = function(name, offset, length, callback) {
        if (this.closed) {
            callback(new Error("Trying to write to closed meta file"));
            return;
        }

        var buffer = new Buffer(1 + name.length + 4 + 4);

        buffer[0] = name.length;
        buffer.write(name, 1, name.length);
        buffer.writeUInt32LE(offset, buffer.length - 4 - 4);
        buffer.writeUInt32LE(length, buffer.length - 4);

        fs.write(this.file, buffer, 0, buffer.length, null, callback);
    };

    /**
     * Return whole log into callback in array of array like:
     * [
     *   [name, offset, length],
     *   [name, offset, length],
     *   ...
     * ]
     *
     * Callback will receive remaining buffer as third argument,
     * usually it will be empty buffer. Use it only in case of emergency.
     *
     * @param {Function} callback Callback to receive log
     */
    FileMetaLog.prototype.getContents = function(callback) {
        var self   = this,
            size   = fs.fstatSync(self.file).size,
            result = [],
            stream,
            buffer,
            length,
            name,
            temp,
            entry;

        if (size == 0) {
            callback(undefined, result);
            return;
        }

        stream = fs.createReadStream(self.path + ".meta", {
            start : 0,
            end   : size - 1
        });

        buffer = new Buffer(0);

        stream.on("readable", function() {
            var data = stream.read();

            if (!data) {
                return;
            }

            buffer = Buffer.concat([buffer, data], buffer.length + data.length);

            while (buffer.length > 0) {
                length = buffer[0] + 1 + 4 + 4;
                if (buffer.length >= length) {
                    entry = new Buffer(length);
                    buffer.copy(entry, 0, 0, length);
                    temp = new Buffer(buffer.length - length);
                    buffer.copy(temp, 0, length, buffer.length);
                    buffer = temp;
                    temp = undefined;

                    name = entry.slice(1, length - 8).toString();

                    result.push([name, entry.readUInt32LE(length - 4 - 4), entry.readUInt32LE(length - 4)]);
                } else {
                    break;
                }
            }
        });

        stream.on("end", callback.bind(this, undefined, result, buffer));
    };

    /**
     * Asynchronously close meta log.
     * Closed log cannot be opened or used again.
     */
    FileMetaLog.prototype.close = function() {
        fs.close(this.file);
        this.closed = true;
    };

    module.exports = FileMetaLog;
})(module);
