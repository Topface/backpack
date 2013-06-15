(function(module) {
    var fs          = require("fs"),
        constants   = process.binding('constants'),
        FileWriter  = require("./FileWriter"),
        FileReader  = require("./FileReader"),
        FileMetaLog = require("./FileMetaLog"),
        readerMode  = constants.O_RDWR | constants.O_CREAT | constants.O_DIRECT,
        writerMode  = constants.O_RDWR | constants.O_CREAT;

    /**
     * Open data file synchronously and initialize it.
     *
     * @param {String} path Full path to data file on filesystem
     * @constructor
     */
    function File(path) {
        this.path   = path;
        this.closed = false;
        this.file   = fs.openSync(this.path, readerMode);
        this.writer = fs.openSync(this.path, writerMode);
        this.offset = fs.fstatSync(this.file).size;
        this.meta   = new FileMetaLog(path);
    }

    /**
     * Return writable stream to write data into this file.
     * Name for written data will be registered after write
     * is successfully finished.
     *
     * @param {String} name Name for data to be written
     * @param {Number} length Length of data to be written
     * @param {Function} callback Callback to receive writer
     */
    File.prototype.getWriter = function(name, length, callback) {
        var self   = this,
            offset = self.offset,
            writer;

        if (self.closed) {
            callback(new Error("Trying to write to closed file"));
            return;
        }

        self.offset += length;

        writer = new FileWriter(self.writer, offset, length);
        writer.on("finish", function() {
            self.meta.register(name, offset, length, function(error) {
                if (error) {
                    writer.emit("error", error);
                } else {
                    writer.emit("indexed");
                }
            });
        });

        callback(undefined, writer);
    };

    /**
     * Return readable stream to read data by offset and length.
     *
     * @param {Number} offset Offset in bytes in data file
     * @param {Number} length Length in bytes of data to read
     * @param {Function} callback Callback to receive reader
     */
    File.prototype.getReader = function(offset, length, callback) {
        var self = this;

        if (self.closed) {
            callback(new Error("Trying to read closed file"));
            return;
        }

        callback(undefined, new FileReader(self.file, offset, length));
    };

    /**
     * Asynchronously close file and meta log.
     * Closed file cannot be opened or used again.
     */
    File.prototype.close = function() {
        fs.close(this.file);
        fs.close(this.writer);

        this.meta.close();
        this.closed = true;
    };

    module.exports = File;
})(module);
