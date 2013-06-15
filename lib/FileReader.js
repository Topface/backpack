(function(module) {
    var fs        = require("fs"),
        stream    = require("stream"),
        aligned   = require("aligned-buffer"),
        alignment = aligned.alignment();

    /**
     * Create file reader for specified fd, offset and length.
     * Reader will read Buffers using O_DIRECT and aligned buffers.
     *
     * @param {Number} file File descriptor to read from
     * @param {Number} offset Read offset in bytes
     * @param {Number} length Length in bytes
     * @constructor
     */
    function FileReader(file, offset, length) {
        stream.Readable.call(this);

        this.finished = false;
        this.file     = file;
        this.length   = length;
        this.offset   = offset;
    }

    FileReader.prototype = Object.create(stream.Readable.prototype, {
        constructor: {
            value: FileReader
        }
    });

    /**
     * Read whole specified data at once using advantages
     * of O_DIRECT and aligned buffers.
     *
     * @private
     */
    FileReader.prototype._read = function() {
        // do nothing if already read everything
        if (this.finished) {
            return;
        }

        var self         = this,
            bufferLength = (Math.ceil(self.length / alignment) + 1) * alignment,
            bufferOffset = self.offset % alignment,
            buffer       = aligned.buffer(alignment, bufferLength),
            readOffset   = Math.floor(self.offset / alignment) * alignment;

        self.finished = true;

        fs.read(self.file, buffer, 0, buffer.length, readOffset, function(error) {
            if (error) {
                self.emit("error", error);
                return;
            }

            // read everything
            self.push(buffer.slice(bufferOffset, bufferOffset + self.length));
            self.push(null);
        });
    };

    module.exports = FileReader;
})(module);
