(function() {
    var assert = require("assert"),
        fs     = require("fs"),
        reader = require("../lib/FileReader"),
        called = {};

    (function testFirstLine() {
        var path = "test/FileReaderTest.txt",
            fd   = fs.openSync(path, "r"),
            r    = new reader(fd, 0, 28);

        r.on("readable", function() {
            called.readable_test_read_first_line = true;
            assert.equal("first line is 28 bytes long\n", r.read());
        });

        r.on("end", function() {
            called.end_test_read_first_line = true;
        });
    })();

    (function pipeFirstLine() {
        var path = "test/FileReaderTest.txt",
            out  = "test/FileReaderTest.tmp",
            fd   = fs.openSync(path, "r"),
            r    = new reader(fd, 0, 28),
            to   = fs.createWriteStream(out, {flags: "w+"});

        r.pipe(to);

        r.on("end", function() {
            called.end_test_pipe_first_line = true;
        });

        to.on("close", function() {
            called.close_test_pipe_first_line = true;
            assert.equal("first line is 28 bytes long\n", fs.readFileSync(out));
        });
    })();

    (function testFirstLine() {
        var path = "test/FileReaderTest.txt",
            fd   = fs.openSync(path, "r"),
            r    = new reader(fd, 28, 118);

        r.on("readable", function() {
            called.readable_test_read_second_line = true;
            assert.equal("second line is so terribly long so you won't believe me " +
                "that i typed it from begin to end by myself oh god here we go\n", r.read());
        });

        r.on("end", function() {
            called.end_test_read_second_line = true;
        });
    })();

    (function testFirstLine() {
        var path = "test/FileReaderTest.txt",
            fd   = fs.openSync(path, "r"),
            r    = new reader(fd, 146, 3);

        r.on("readable", function() {
            called.readable_test_read_third_line = true;
            assert.equal("pew", r.read());
        });

        r.on("end", function() {
            called.end_test_read_third_line = true;
        });
    })();

    process.on("exit", function() {
        assert.ok(called.readable_test_read_first_line);
        assert.ok(called.end_test_read_first_line);

        assert.ok(called.end_test_pipe_first_line);
        assert.ok(called.close_test_pipe_first_line);

        assert.ok(called.readable_test_read_second_line);
        assert.ok(called.end_test_read_second_line);

        assert.ok(called.readable_test_read_third_line);
        assert.ok(called.end_test_read_third_line);

        assert.ok(!called.some_nonexisting_key);

        console.log("FileReaderTest successfully finished!");
    });
})();
