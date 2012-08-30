(function(module) {
    var fs = require("fs");

    function FileMetaLog(path) {
        var self = this;

        self.path     = path;
        self.closed   = false;
        self.file     = fs.openSync(self.path + ".meta", "a");
    }

    FileMetaLog.prototype.register = function(name, offset, length, callback) {
        if (this.closed) {
            return callback(new Error("Trying to write to closed meta file"));
        }

        var buffer = new Buffer(1 + name.length + 4 + 4);

        buffer[0] = name.length;
        buffer.write(name, 1, name.length);
        buffer.writeUInt32LE(offset, buffer.length - 4 - 4);
        buffer.writeUInt32LE(length, buffer.length - 4);

        fs.write(this.file, buffer, 0, buffer.length, null, callback);
    };

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
            return callback(undefined, result);
        }

        stream = fs.createReadStream(self.path + ".meta", {
            start : 0,
            end   : size - 1
        });

        buffer = new Buffer(0);

        stream.on("data", function(data) {
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

        stream.on("end", function() {
            if (buffer.length) {
                console.log("buffer remained after parsing: " + buffer.length)
            }

            callback(undefined, result);
        });
    };

    FileMetaLog.prototype.close = function() {
        this.file.close();
        this.closed = true;
    };

    module.exports = FileMetaLog;
})(module);
