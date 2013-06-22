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
