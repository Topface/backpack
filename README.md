# backpack

Ultimately fast storage for billions of files with http interface.

## How it works

This project is inspired by Haystack from Facebook that is not currently open-source project.
You may read whitepaper about their implementation and some history in this document:
[Finding a needle in Haystack: Facebook’s photo storage](http://static.usenix.org/event/osdi10/tech/full_papers/Beaver.pdf)

When you need to save billions of small files on fs and access them fast, you will need
to make many seeks on physical disk do get files. If you don't care about permissions
for files and other metadata you'll have a huge overhead.

Backpack store all metadata in memory and only need one read per file. It groups small
files into big ones and always keep them open to return data much faster than usual fs.
You also get much better space utilisation for free, because there's no need to store
useless metadata. Note that backpack does not overwrite files, it's not replacement
for file system. Store only data that won't change if you don't want to waste disk space.

## Dependencies

* [redis](htt://redis.io/) - redis to save meta information about stored files

## Running server

1. Install and run launch server. Let's assume that it's bound to `127.0.0.1:6379`

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

* PUT request to save file at specified url (query string is taken into accout)

* GET request to retrieve file.

* GET /stats to get some stats.

## Stats

You may ask backpack for stats by hitting `/stats` url.

This is what you'll get:

```javascript
{
    "gets": {
        "count" : 142028, // count of GET requests
        "avg"   : 10.513109137048584 // average response time in ms for latest 1000 GET requests
    },
    "puts":{
        "count" : 1360, // count of PUT requests
        "avg"   : 16.855013758303212 // average response time in ms for latest 1000 PUT requests
    }
}
```

## Utilities

* `./bin/backpack-add` - Add data files to storage to extend capacity.

* `./bin/backpack-upload` - Upload file to storage.

* `./bin/backpack-dump-log` - Dump files with lengths and offsets of specified storage file.

* `./bin/backpack-clear` - Clear storage file to free up some space.

## Authors

* [Ian Babrou](https://github.com/bobrik)

### License

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2012.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

This software also contains: