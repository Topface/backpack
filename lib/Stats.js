(function(module) {
    function Stats() {
        this.granularity = 1000;

        this.stats = {
            gets: {
                count : 0,
                avg   : 0
            },
            puts: {
                count : 0,
                avg   : 0
            }
        };
    }

    Stats.prototype.countPut = function(time) {
        this.count("puts", time);
    };

    Stats.prototype.countGet = function(time) {
        this.count("gets", time);
    };

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

    Stats.prototype.export = function() {
        return this.stats;
    };

    module.exports = Stats;
})(module);
