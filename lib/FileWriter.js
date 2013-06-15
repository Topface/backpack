(function(module) {
    var fs     = require("fs"),
        stream = require("stream");

    /**
     * Create file writer for specified fd, offset and length.
     *
     * Will emit:
     * - "indexed" when written to log file
     * - "registered" when registered in redis
     *
     * It's safe to return success after both event triggered.
     *
     * @param {Number} file File descriptor to write to
     * @param {Number} offset Write offset in bytes
     * @param {Number} length Length in bytes
     * @constructor
     */
    function FileWriter(file, offset, length) {
        stream.Writable.call(this);

        this.file   = file;
        this.pos    = 0;
        this.offset = offset;
        this.length = length;
    }

    FileWriter.prototype = Object.create(stream.Writable.prototype, {
        constructor: {
            value: FileWriter
        }
    });

    /**
     * Writable stream main method.
     *
     * @param {Buffer} chunk Buffer to write
     * @param {String} encoding Encoding, always ignored
     * @param {Function} callback Callback to write when chunk is written
     * @private
     */
    FileWriter.prototype._write = function(chunk, encoding, callback) {
        if (chunk.length + this.pos > this.length) {
            callback(new Error("Trying to write more data than requested"));
            return;
        }

        fs.write(this.file, chunk, 0, chunk.length, this.offset + this.pos, callback);
        this.pos += chunk.length;
    };

    module.exports = FileWriter;
})(module);
