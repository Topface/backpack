(function() {
    var assert  = require("assert"),
        async   = require("async"),
        simple  = require("simple_redis"),
        manager = require("../lib/FileManager"),
        tests   = {},
        called  = {};

    tests.testEmptyManager = function(callback) {
        var tests = [],
            m;

        simple.request("ibobrik@gmail.com", {return_buffers: true}, function(error, client) {
            assert.ifError(error);

            // flush redis data
            tests.push(function(callback) {
                client.flushdb(callback);
            });

            // create manager
            tests.push(function(callback) {
                m = new manager("test/data", client);
                m.load(callback);
            });

            // get files
            tests.push(function(callback) {
                m.getFiles(function(error, files) {
                    assert.ifError(error);
                    assert.equal(0, Object.keys(files).length);

                    callback();
                });
            });

            // get nonexistent file
            tests.push(function(callback) {
                m.getFile(1, function(error) {
                    assert.ok(error);
                    callback();
                });
            });

            async.series(tests, function(error) {
                assert.ifError(error);
                client.quit();

                callback();
            })
        });
    };

    tests.testManagerWithData = function(callback) {
        var tests = [],
            m;

        simple.request("ibobrik@gmail.com", {return_buffers: true}, function(error, client) {
            assert.ifError(error);

            // flush redis data
            tests.push(function(callback) {
                client.flushdb(callback);
            });

            // create file manager
            tests.push(function(callback) {
                m = new manager("test/data", client);
                m.load(callback);
            });

            // add storage
            tests.push(function(callback) {
                m.addStorageFile(function(error, id) {
                    assert.ifError(error);
                    assert.equal(1, id);

                    m.addStorageFile(function(error, id) {
                        assert.ifError(error);
                        assert.equal(2, id);

                        callback();
                    });
                });
            });

            // get files
            tests.push(function(callback) {
                m.getFiles(function(error, files) {
                    assert.ifError(error);
                    assert.equal(2, Object.keys(files).length);

                    callback();
                });
            });

            // check first file info
            tests.push(function(callback) {
                m.getFile(1, function(error, file) {
                    assert.ifError(error);
                    assert.equal("test/data/data_1", file.path);
                    assert.equal(0, file.offset);
                    assert.equal(file.meta.getContents(function(error, contents) {
                        assert.ifError(error);
                        assert.equal(0, contents.length);

                        callback();
                    }));
                });
            });

            // check second file info
            tests.push(function(callback) {
                m.getFile(2, function(error, file) {
                    assert.ifError(error);
                    assert.equal("test/data/data_2", file.path);
                    assert.equal(0, file.offset);
                    assert.equal(file.meta.getContents(function(error, contents) {
                        assert.ifError(error);
                        assert.equal(0, contents.length);

                        callback();
                    }));
                });
            });

            // save file one
            tests.push(function(callback) {
                var indexed    = false,
                    registered = false;

                m.getFileWriter("one", 6, function(error, writer) {
                    assert.ifError(error);

                    writer.on("registered", function() {
                        registered = true;

                        called.file_one_registered = true;

                        if (indexed) {
                            callback();
                        }
                    });

                    writer.on("indexed", function() {
                        indexed = true;

                        called.file_one_indexed = true;

                        if (registered) {
                            callback();
                        }
                    });

                    writer.end("pewpew");
                });
            });

            // save file two
            tests.push(function(callback) {
                var indexed    = false,
                    registered = false;

                m.getFileWriter("two", 7, function(error, writer) {
                    assert.ifError(error);

                    writer.on("registered", function() {
                        registered = true;

                        called.file_two_registered = true;

                        if (indexed) {
                            callback();
                        }
                    });

                    writer.on("indexed", function() {
                        indexed = true;

                        called.file_two_indexed = true;

                        if (registered) {
                            callback();
                        }
                    });

                    writer.end("another");
                });
            });

            // check files count in first file
            tests.push(function(callback) {
                m.getFile(1, function(error, file) {
                    assert.ifError(error);
                    assert.equal(6 + 7, file.offset);
                    assert.equal(file.meta.getContents(function(error, contents) {
                        assert.ifError(error);
                        assert.equal(2, contents.length);
                        assert.equal('[["one",0,6],["two",6,7]]', JSON.stringify(contents));

                        callback();
                    }));
                });
            });

            // check files count in second file
            tests.push(function(callback) {
                m.getFile(2, function(error, file) {
                    assert.ifError(error);
                    assert.equal(0, file.offset);
                    assert.equal(file.meta.getContents(function(error, contents) {
                        assert.ifError(error);
                        assert.equal(0, contents.length);

                        callback();
                    }));
                });
            });

            // get file one
            tests.push(function(callback) {
                m.getFileReader("one", function(error, reader) {
                    assert.ifError(error);
                    assert.ok(reader);

                    assert.equal(null, reader.read());
                    reader.on("readable", function() {
                        assert.equal("pewpew", reader.read());
                        called.read_file_one = true;
                    });

                    reader.on("end", function() {
                        called.end_file_one = true;
                        callback();
                    })
                });
            });

            // get file two
            tests.push(function(callback) {
                m.getFileReader("two", function(error, reader) {
                    assert.ifError(error);
                    assert.ok(reader);

                    assert.equal(null, reader.read());
                    reader.on("readable", function() {
                        assert.equal("another", reader.read());
                        called.read_file_two = true;
                    });

                    reader.on("end", function() {
                        called.end_file_two = true;
                        callback();
                    })
                });
            });

            // reload file manager
            tests.push(function(callback) {
                m = new manager("test/data", client);
                m.load(callback);
            });

            // recheck files count
            tests.push(function(callback) {
                m.getFiles(function(error, files) {
                    assert.ifError(error);
                    assert.equal(2, Object.keys(files).length);

                    callback();
                });
            });

            async.series(tests, function(error) {
                assert.ifError(error);
                client.quit();

                callback();
            });
        });
    };

    async.series(tests, function(error) {
        assert.ifError(error);
    });

    process.on("exit", function() {
        assert.ok(called.file_one_registered);
        assert.ok(called.file_one_indexed);
        assert.ok(called.file_two_registered);
        assert.ok(called.file_two_indexed);

        assert.ok(called.read_file_one);
        assert.ok(called.end_file_one);
        assert.ok(called.read_file_two);
        assert.ok(called.end_file_two);

        assert.ok(!called.some_nonexisting_key);

        console.log("FileManagerTest successfully finished!");
    });
})();
