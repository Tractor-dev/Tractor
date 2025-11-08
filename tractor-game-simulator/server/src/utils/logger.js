const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'INFO';
  }

  log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}]`, message, ...args);
  }

  error(message, ...args) {
    this.log(LOG_LEVELS.ERROR, message, ...args);
  }

  warn(message, ...args) {
    this.log(LOG_LEVELS.WARN, message, ...args);
  }

  info(message, ...args) {
    this.log(LOG_LEVELS.INFO, message, ...args);
  }

  debug(message, ...args) {
    if (this.level === 'DEBUG') {
      this.log(LOG_LEVELS.DEBUG, message, ...args);
    }
  }
}

export default new Logger();
