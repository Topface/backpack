(function() {
    var assert = require("assert"),
        fs     = require("fs"),
        writer = require("../lib/FileWriter"),
        called = {};

    (function testFirstWriteFromZero() {
        var out  = "test/FileWriterTest1.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 10);

        w.on("finish", function() {
            assert.equal("pew pewwtf", fs.readFileSync(out).toString());
            called.finish_test_first_write_from_zero = true;
        });

        w.write(new Buffer("pew pew"));
        w.end(new Buffer("wtf"));
    })();

    (function testFirstWriteWithEnd() {
        var out  = "test/FileWriterTest2.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 5);

        w.on("finish", function() {
            assert.equal("enddd", fs.readFileSync(out).toString());
            called.finish_test_first_write_with_end = true;
        });

        w.end(new Buffer("enddd"));
    })();

    (function testDoubleWrite() {
        var out  = "test/FileWriterTest3.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 10);

        w.on("finish", function() {
            called.finish_test_double_write_first = true;

            assert.equal("pew pewwtf", fs.readFileSync(out).toString());

            fd = fs.openSync(out, "r+");
            w  = new writer(fd, 4, 3);

            assert.equal("pew pewwtf", fs.readFileSync(out).toString());

            w.on("finish", function() {
                called.finish_test_double_write_second = true;
                assert.equal("pew lolwtf", fs.readFileSync(out).toString())
            });

            w.write(new Buffer("lol"));
            w.end();
        });

        w.write(new Buffer("pew pew"));
        w.end(new Buffer("wtf"));
    })();

    (function testPipe() {
        var path = "test/FileWriterTest.in",
            out  = "test/FileWriterTest4.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 29),
            from = fs.createReadStream(path);

        from.pipe(w);

        from.on("end", function() {
            called.end_test_pipe = true;
            assert.equal(fs.readFileSync(path).toString(), fs.readFileSync(out).toString());
        });
    })();

    (function testOverwrite() {
        var out  = "test/FileWriterTest5.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 5);

        w.on("error", function() {
            called.error_test_overwrite = true;
        });

        w.end(new Buffer("123456"));
    })();

    (function testEncoding() {
        var out  = "test/FileWriterTest6.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 5);

        w.on("finish", function() {
            assert.equal("enddd", fs.readFileSync(out).toString());
            called.finish_test_encoding = true;
        });

        w.end("enddd");
    })();

    (function testCallbackOnWrite() {
        var out  = "test/FileWriterTest7.tmp",
            fd   = fs.openSync(out, "w+"),
            w    = new writer(fd, 0, 5);

        w.on("finish", function() {
            assert.equal("aabb", fs.readFileSync(out).toString());
            called.finish_test_callback_rewrite = true;
        });

        w.write("aa", function() {
            called.write_test_callback_rewrite = true;
        });

        w.end("bb", function() {
            called.end_test_callback_rewrite = true;
        });
    })();

    (function testLargeData() {
        var out  = "test/FileWriterTest8.tmp",
            fd   = fs.openSync(out, "w+"),
            max  = 1024 * 1024 * 5,
            size = 1024,
            w    = new writer(fd, 0, max),
            cur  = 0;

        w.on("finish", function() {
            assert.equal(w.length, fs.readFileSync(out).length);
            called.finish_test_large_data = true;
        });


        function getChunk(size) {
            var chunk = "";
            while (chunk.length < size) {
                chunk += Math.random().toString();
            }

            return chunk.substr(0, size);
        }

        (function write() {
            var chunk;

            if (cur == max) {
                w.end();
                return;
            }

            if (cur + size > max) {
                throw new Error("Incorrect data size selected for test!");
            }

            chunk = getChunk(size);
            assert.equal(size, chunk.length);

            w.write(chunk, write);

            cur += chunk.length;
        })();
    })();

    process.on("exit", function() {
        assert.ok(called.finish_test_first_write_from_zero);

        assert.ok(called.finish_test_first_write_with_end);

        assert.ok(called.finish_test_double_write_first);
        assert.ok(called.finish_test_double_write_second);

        assert.ok(called.end_test_pipe);

        assert.ok(called.error_test_overwrite);

        assert.ok(called.finish_test_encoding);

        assert.ok(called.finish_test_callback_rewrite);
        assert.ok(called.write_test_callback_rewrite);
        assert.ok(called.end_test_callback_rewrite);

        assert.ok(called.finish_test_large_data);

        assert.ok(!called.some_nonexisting_key);

        console.log("FileWriterTest successfully finished!");
    });
})();
