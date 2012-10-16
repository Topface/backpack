(function(module) {
    var fs        = require("fs"),
        util      = require("util"),
        stream    = require("stream"),
        aligned   = require("aligned-buffer"),
        alignment = aligned.alignment();

    function FileReader(file, offset, length) {
        var self = this;

        self.file   = file;
        self.pos    = 0;
        self.chunk  = length;
        self.length = length;
        self.offset = Math.floor(offset / alignment) * alignment;

        process.nextTick(function read() {
            var chunk  = Math.ceil(chunk / alignment) * alignment,
                buffer = aligned.buffer(alignment, (Math.ceil(length / alignment) + 1) * alignment);

            if (chunk == 0) {
                self.emit("end");
                return;
            }

            fs.read(self.file, buffer, 0, buffer.length, self.offset + self.pos, function(error) {
                if (error) {
                    self.emit(error);
                    return;
                }

                self.emit("data", buffer.slice(offset % alignment, (offset % alignment) + length));
                self.pos += chunk;
                process.nextTick(read);
            });
        });
    }

    util.inherits(FileReader, stream);

    FileReader.prototype.getSize = function() {
        return this.length;
    };

    module.exports = FileReader;
})(module);
