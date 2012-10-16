(function(module) {
    var fs        = require("fs"),
        util      = require("util"),
        stream    = require("stream"),
        aligned   = require("aligned-buffer"),
        alignment = aligned.alignment();

    function FileReader(file, offset, length) {
        var self = this;

        self.file   = file;
        self.length = length;
        self.offset = Math.floor(offset / alignment) * alignment;

        process.nextTick(function read() {
            var buffer = aligned.buffer(alignment, (Math.ceil(length / alignment) + 1) * alignment);

            fs.read(self.file, buffer, 0, buffer.length, self.offset, function(error) {
                if (error) {
                    self.emit(error);
                    return;
                }

                self.emit("data", buffer.slice(offset % alignment, (offset % alignment) + length));
                self.emit("end");
            });
        });
    }

    util.inherits(FileReader, stream);

    FileReader.prototype.getSize = function() {
        return this.length;
    };

    module.exports = FileReader;
})(module);
