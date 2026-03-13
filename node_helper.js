'use strict';

/* Magic Mirror
 * Module: MMM-SystemStats
 *
 * By Benjamin Roesner http://benjaminroesner.com
 * MIT Licensed.
 */

const NodeHelper = require('node_helper');
const async = require('async');
const exec = require('child_process').exec;
const fs = require('fs');
const request = require('request');

const FAN_LOG = '/var/log/fanControl.log';

module.exports = NodeHelper.create({
  start: function() {
    //console.log('Starting node helper: ' + this.name);
  },

  socketNotificationReceived: function(notification, payload) {
    var self = this;

    if (notification === 'CONFIG') {
      this.config = payload;
      self.getStats();
      setInterval(function() {
        self.getStats();
      }, this.config.updateInterval);
    }
    else if (notification === 'ALERT') {
      this.config = payload.config;
      request({ url: payload.config.baseURLSyslog + '?type=' + payload.type + '&message=' + encodeURI(payload.message), method: 'GET' }, function(error, response, body) {
        console.log('notif MMM-syslog with response ' + response.statusCode);
      });
    }
  },

  getFanStats: function() {
    var speed = 'N/A';
    var status = 'N/A';
    try {
      var log = fs.readFileSync(FAN_LOG, 'utf8');
      // Match "fanSpeed   50" or "fanSpeed 100" (may have leading spaces)
      var m = log.match(/fanSpeed\s+(-?\d+(?:\.\d+)?)/);
      if (m) {
        var pct = Math.round(parseFloat(m[1]));
        speed = pct + '%';
        if (pct <= 0) {
          status = 'OFF';
        } else if (pct < 50) {
          status = 'LOW';
        } else if (pct < 90) {
          status = 'MED';
        } else {
          status = 'HIGH';
        }
      }
    } catch (e) {
      // log not available
    }
    return { fanPWM: speed, fanStatus: status };
  },

  getStats: function() {
    var self = this;

    var temp_conv = '';
    switch (this.config.units) {
    case 'imperial':
      temp_conv = 'awk \'{printf("%.1f°F\\n",(($1*1.8)/1e3)+32)}\'';
      break;
    case 'metric':
      temp_conv = 'awk \'{printf("%.1f°C\\n",$1/1e3)}\'';
      break;
    case 'default':
    default:
      temp_conv = 'awk \'{printf("%.1f°K\\n",($1/1e3)+273.15)}\'';
      break;
    }

    async.parallel([
      // get cpu temp
      async.apply(exec, temp_conv + ' /sys/class/thermal/thermal_zone0/temp'),
      // get system load
      async.apply(exec, 'cat /proc/loadavg'),
      // get free ram in %
      async.apply(exec, "free | awk '/^Mem:/ {print $4*100/$2}'"),
      // get uptime
      async.apply(exec, 'cat /proc/uptime'),
      // get root free-space
      async.apply(exec, "df -h|grep /dev/root|awk '{print $4}'"),
    ],
    function(err, res) {
      var stats = {};
      stats.cpuTemp = res[0][0];
      stats.sysLoad = res[1][0].split(' ');
      stats.freeMem = res[2][0];
      stats.upTime = res[3][0].split(' ');
      stats.freeSpace = res[4][0];

      // Read fan stats from fanControl log
      var fan = self.getFanStats();
      stats.fanPWM = fan.fanPWM;
      stats.fanStatus = fan.fanStatus;

      self.sendSocketNotification('STATS', stats);
    });
  },

  // http://unix.stackexchange.com/questions/69185/getting-cpu-usage-same-every-time/69194#69194
});
