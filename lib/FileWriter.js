(function(module) {
    var fs     = require("fs"),
        util   = require("util"),
        events = require("events");

    function FileWriter(file, offset, length) {
        this.file   = file;
        this.pos    = 0;
        this.offset = offset;
        this.length = length;
    }

    util.inherits(FileWriter, events.EventEmitter);

    FileWriter.prototype.writable = true;

    FileWriter.prototype.getOffset = function() {
        return this.offset;
    };

    FileWriter.prototype.write = function(data) {
        var self = this;

        if (data.length + self.pos > self.length) {
            self.emit("error", new Error("Trying to write more data than requested"));
            return false;
        }

        fs.write(self.file, data, 0, data.length, self.offset + self.pos, function(error) {
            if (error) {
                self.emit(error);
            }

            self.emit("drain");
        });
        self.pos += data.length;

        return false;
    };

    FileWriter.prototype.end = function() {
        this.writable = false;
        this.emit("close");
        this.removeAllListeners();
    };

    module.exports = FileWriter;
})(module);
