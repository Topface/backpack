(function(module) {
    var fs     = require("fs"),
        util   = require("util"),
        stream = require("stream");

    function FileReader(file, offset, length) {
        var self = this;

        self.file   = file;
        self.pos    = 0;
        self.chunk  = 1024 * 64;
        self.offset = offset;
        self.length = length;

        process.nextTick(function read() {
            var chunk  = Math.min(self.chunk, self.length - self.pos),
                buffer = new Buffer(chunk);

            if (chunk == 0) {
                return self.emit("end");
            }

            fs.read(self.file, buffer, 0, chunk, self.offset + self.pos, function(error) {
                if (error) {
                    return self.emit(error);
                }

                self.emit("data", buffer);
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
