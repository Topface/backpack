(function(module) {

    /**
     * Object to collect stats about requests.
     *
     * @param {Number} granularity Amount of latest requests to calculate averages
     * @constructor
     */
    function Stats(granularity) {
        this.granularity = granularity || 1000;

        this.stats = {
            gets: {
                count : 0,
                bytes : 0,
                avg   : 0
            },
            puts: {
                count : 0,
                bytes : 0,
                avg   : 0
            }
        };
    }

    /**
     * Count PUT request with specified size and duration.
     *
     * @param {Number} size Processed data size
     * @param {Number} time Processing time
     */
    Stats.prototype.countPut = function(size, time) {
        this.stats.puts.bytes += size;
        this.count("puts", time);
    };

    /**
     * Count GET requests with specified size and duration.
     *
     * @param {Number} size Processed data size
     * @param {Number} time Processing time
     */
    Stats.prototype.countGet = function(size, time) {
        this.stats.gets.bytes += size;
        this.count("gets", time);
    };

    /**
     * Count request by type and duration to calculate
     * average time across latest requests.
     *
     * @param {String} type Request type (get or put)
     * @param {Number} time Processing time
     */
    Stats.prototype.count = function(type, time) {
        var avg         = this.stats[type].avg,
            granularity = this.granularity;

        if (avg > 0) {
            if (this.stats[type].count < granularity) {
                granularity = this.stats[type].count;
            }

            this.stats[type].avg = ((avg * granularity) - avg + time) / granularity;
        } else {
            this.stats[type].avg = time;
        }

        this.stats[type].count += 1;
    };

    module.exports = Stats;
})(module);
