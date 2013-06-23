# backpack

Ultimately fast storage for billions of files with http interface.
This is not a database, this is an append-only mostly-reads storage.
This is a good photo storage if you want to build your own facebook, imgur or tumblr.

## How it works

This project is inspired by Haystack from Facebook that is not currently an open-source project.
You may read whitepaper about their implementation and some history in this document:
[Finding a needle in Haystack: Facebook’s photo storage](http://static.usenix.org/event/osdi10/tech/full_papers/Beaver.pdf)

When you need to save billions of small files on fs and access them fast, you will need
to make many seeks on physical disk to get files. If you don't care about permissions
for files and other metadata you'll have a huge overhead.

Backpack stores all metadata in memory and only need one read per file. It groups small
files into big ones and always keeps them open to return data much faster than usual fs.
You also get much better space utilisation for free, because there's no need to store
useless metadata. Note that backpack does not overwrite files, it's not a replacement
for file system. Store only data that won't change if you don't want to waste disk space.

Backpack also have metadata for every data file so you can restore your data if
redis failed and lost some parts of data. However, disks can fail so we recommend
to save every piece of you data on different machines or even in different data centers.

## Production usage

We use it in [Topface](http://topface.com/) as photo storage for more than 100 million photos.
Backpack instances managed by [coordinators](https://github.com/Topface/backpack-coordinator)
and organized into shards to provide high availability and better performance.

## Benchmarks

Let's take 1 750 000 real photos from Topface and compare backpack and nginx. We'll use
two identical servers with 1Tb SATA disks (WDC WD1003FBYX-01Y7B1). Nginx is high-performance
web server so it should be fair competition. We'll save files in nginx with scheme
`xx/yy/u123_abc.jpg` to keep directory size relatively small.

### Writing

Backpack: 175 240 megabytes on disk, 1h41m to write.

Nginx: 177 483 megabytes on disk, 2h13m to write.

Result: 23% faster, just a bit smaller size on disk. But that's not the case, actually.

### Reading

In real world you cannot read files sequentially. People do random things on internet and
request random files. We cannot put files in order people will read them, so we'll just
pick 100 000 random files to read (same for nginx and backpack). To be fair, we'll drop
all page cache on linux with `echo 3 > /proc/sys/vm/drop_caches`.

It's better to see on graphs how it looks like (backpack is red, nginx is green).

* Requests per second.

![requests per second](http://i.imgur.com/1R0Kvld.png)

Backpack finished after 792 seconds, nginx after 1200 seconds. 33% faster!
Here you may see that nginx is getting faster but it has it's limits.

* Reads per second (from `iostat -x -d 10`).

![reads per second](http://i.imgur.com/kKUzCWy.png)

Here you may see the reason why nginx is slower: there are too many seeks.
Nginx needs to open directories and fetch file metadata that isn't in cache.
Note that you can't cache everything you need if you store more data
that in this test. Real servers hold way more data.

Backpack only read the data and does not seek too much.

* Disk io utilization (from `iostat -x -d 10`).

Both disks are used by 100% while reads are active.

![disk io utilization](http://i.imgur.com/aePjesO.png)

Now imagine that you have not 1 750 000 files, but 22 000 000 files on single server.
Extra seek for no reason will choke your system under load. That is the main reason
why we came up with backpack.

## Dependencies

* [redis](htt://redis.io/) - redis to save meta information about stored files

## Running server

1. Install and run redis server. Let's assume that it's bound to `127.0.0.1:6379`

2. Decide where you want to save your files. Let's assume that you want to store files in `/var/backpack`.

3. Add some storage capacity to your backpack:

    ```
    # each run of this command will add you
    # approximately 3.5Gb of storage capacity
    ./bin/backpack-add /var/backpack 127.0.0.1 6379
    ```

4. Run you server. Let's assume that you want to listen for `127.0.0.1:8080`

    ```
    ./bin/backpack /var/backpack 127.0.0.1 8080 127.0.0.1 6379
    ```

Now you may try to upload file to your storage:

```
./bin/backpack-upload 127.0.0.1 8080 /etc/hosts my/hosts
```

And download file you just uploaded:

```
wget http://127.0.0.1:8080/my/hosts
```

## API

Api is very straightforward:

* PUT request to save file at specified url (query string is taken into account).

* GET request to retrieve saved file.

* GET /stats to get some stats about what is happening.

## Stats

You may ask backpack for stats by hitting `/stats` url.

This is what you'll get (real example from production server at Topface):

```javascript
{
    "gets": {
        "count" : 273852, // count of GET requests
        "bytes" : 66603359793, // total size of responses in bytes
        "avg"   : 17.317889781518243 // average response time in ms for latest 1000 GET requests
    },
    "puts":{
        "count" : 5604, // count of PUT requests
        "bytes" : 1616002993, // size of written data in bytes
        "avg"   : 4.842664467849093 // average response time in ms for latest 1000 PUT requests
    }
}
```

## Utilities

* `./bin/backpack-add` - Add data files to storage to extend capacity.

* `./bin/backpack-upload` - Upload file to storage.

* `./bin/backpack-dump-log` - Dump files with lengths and offsets of specified storage file.

* `./bin/backpack-list` - List data files with their sizes and read-only flags.

* `./bin/backpack-get-file-info` - Get data file number, offset and length by file name.

* `./bin/backpack-restore-from-log` - Restore redis index from data file log.

## Authors

* [Ian Babrou](https://github.com/bobrik)
