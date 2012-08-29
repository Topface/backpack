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

    FileMetaLog.prototype.close = function() {
        this.file.close();
        this.closed = true;
    };

    module.exports = FileMetaLog;
})(module);
