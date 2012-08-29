(function(module) {
    var fs          = require("fs"),
        FileWriter  = require("./FileWriter"),
        FileReader  = require("./FileReader"),
        FileMetaLog = require("./FileMetaLog");

    function File(path) {
        this.path   = path;
        this.closed = false;
        this.file   = fs.openSync(this.path, "a+");
        this.offset = fs.fstatSync(this.file).size;
        this.meta   = new FileMetaLog(path);
    }

    File.prototype.getWriter = function(name, length, callback) {
        var self   = this,
            offset = self.offset,
            writer;

        if (self.closed) {
            return callback(new Error("Trying to write to closed file"));
        }

        self.offset += length;

        writer = new FileWriter(self.file, offset, length);
        writer.on("error", function(error) {
            console.log(error);
        });
        writer.on("close", function() {
            self.meta.register(name, offset, length, function(error) {
                if (error) {
                    console.log(error);
                }
            })
        });

        callback(undefined, writer);
    };

    File.prototype.getReader = function(offset, length, callback) {
        var self = this;

        if (self.closed) {
            return callback(new Error("Trying to read closed file"));
        }

        callback(undefined, new FileReader(self.file, offset, length));
    };

    File.prototype.getNames = function(callback) {
        return this.meta.getNames(callback);
    };

    File.prototype.close = function() {
        fs.close(this.file);
        this.meta.close();
        this.closed = true;
    };

    module.exports = File;
})(module);
