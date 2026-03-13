/* global Module */

/* Magic Mirror
 * Module: MMM-SystemStats
 *
 * By Benjamin Roesner http://benjaminroesner.com
 * MIT Licensed.
 */

Module.register('MMM-SystemStats', {

  defaults: {
    updateInterval: 10000,
    animationSpeed: 0,
    align: 'right',
    language: config.language,
    units: config.units,
    useSyslog: false,
    thresholdCPUTemp: 75,
    baseURLSyslog: 'http://127.0.0.1:8080/syslog',
    label: 'textAndIcon'
  },

  getStyles: function() {
    return ['font-awesome.css'];
  },

  getScripts: function() {
    return ['moment.js', 'moment-duration-format.js'];
  },

  getTranslations: function() {
    return {
      'en': 'translations/en.json',
      'fr': 'translations/fr.json',
      'id': 'translations/id.json',
      'de': 'translations/de.json'
    };
  },

  start: function() {
    Log.log('Starting module: ' + this.name);
    moment.locale(this.config.language);

    this.stats = {};
    var loading = this.translate('LOADING').toLowerCase();
    this.stats.cpuTemp   = loading;
    this.stats.sysLoad   = loading;
    this.stats.freeMem   = loading;
    this.stats.upTime    = loading;
    this.stats.freeSpace = loading;
    this.stats.fanPWM    = loading;
    this.stats.fanStatus = loading;
    this.sendSocketNotification('CONFIG', this.config);
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === 'STATS') {
      this.stats.cpuTemp = payload.cpuTemp;

      if (this.config.useSyslog) {
        var cpuTemp = Math.ceil(parseFloat(this.stats.cpuTemp));
        if (cpuTemp > this.config.thresholdCPUTemp) {
          console.log('alert for threshold violation (' + cpuTemp + '/' + this.config.thresholdCPUTemp + ')');
          this.sendSocketNotification('ALERT', {
            config: this.config,
            type: 'WARNING',
            message: this.translate('TEMP_THRESHOLD_WARNING') + ' (' + this.stats.cpuTemp + '/' + this.config.thresholdCPUTemp + ')'
          });
        }
      }

      this.stats.sysLoad   = payload.sysLoad[0];
      this.stats.freeMem   = Number(payload.freeMem).toFixed() + '%';
      upTime = parseInt(payload.upTime[0]);
      this.stats.upTime    = moment.duration(upTime, 'seconds').humanize();
      this.stats.freeSpace = payload.freeSpace;
      this.stats.fanPWM    = payload.fanPWM   || 'N/A';
      this.stats.fanStatus = payload.fanStatus || 'N/A';
      this.updateDom(this.config.animationSpeed);
    }
  },

  getDom: function() {
    var self = this;
    var wrapper = document.createElement('table');

    var sysData = {
      cpuTemp: {
        text: 'CPU_TEMP',
        icon: 'fa-thermometer',
      },
      sysLoad: {
        text: 'SYS_LOAD',
        icon: 'fa-tachometer',
      },
      freeMem: {
        text: 'RAM_FREE',
        icon: 'fa-microchip',
      },
      upTime: {
        text: 'UPTIME',
        icon: 'fa-clock-o',
      },
      freeSpace: {
        text: 'DISK_FREE',
        icon: 'fa-hdd-o',
      },
      fanPWM: {
        text: 'FAN_PWM',
        icon: 'fa-cog',
      },
      fanStatus: {
        text: 'FAN_STATUS',
        icon: 'fa-adjust',
      },
    };

    Object.keys(sysData).forEach(function(item) {
      var row = document.createElement('tr');

      if (self.config.label.match(/^(text|textAndIcon)$/)) {
        var c1 = document.createElement('td');
        c1.setAttribute('class', 'title');
        c1.style.textAlign = self.config.align;
        c1.innerText = self.translate(sysData[item].text);
        row.appendChild(c1);
      }

      if (self.config.label.match(/^(icon|textAndIcon)$/)) {
        var c2 = document.createElement('td');
        c2.innerHTML = '<i class="fa ' + sysData[item].icon + ' fa-fw"></i>';
        row.appendChild(c2);
      }

      var c3 = document.createElement('td');
      c3.setAttribute('class', 'value');
      c3.style.textAlign = self.config.align;
      c3.innerText = self.stats[item];
      row.appendChild(c3);

      wrapper.appendChild(row);
    });

    return wrapper;
  },
});
