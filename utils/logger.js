const chalk = require('chalk');
const moment = require('moment-timezone');

class Logger {
    constructor() {
        this.timezone = 'Asia/Seoul';
    }

    getTimestamp() {
        return moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss');
    }

    log(level, message, ...args) {
        const timestamp = chalk.gray(`[${this.getTimestamp()}]`);
        const formattedMessage = this.formatMessage(level, message, ...args);
        console.log(`${timestamp} ${formattedMessage}`);
    }

    formatMessage(level, message, ...args) {
        const levels = {
            // 시스템 관련
            'SYSTEM': {
                emoji: '⚙️',
                color: chalk.cyan,
                label: 'SYSTEM'
            },
            'STARTUP': {
                emoji: '🚀',
                color: chalk.green.bold,
                label: 'STARTUP'
            },
            'READY': {
                emoji: '✅',
                color: chalk.green,
                label: 'READY'
            },
            
            // 정보 관련
            'INFO': {
                emoji: 'ℹ️',
                color: chalk.blue,
                label: 'INFO'
            },
            'SUCCESS': {
                emoji: '✨',
                color: chalk.green,
                label: 'SUCCESS'
            },
            
            // 모듈 관련
            'MODULE': {
                emoji: '📦',
                color: chalk.magenta,
                label: 'MODULE'
            },
            'MODULE_LOAD': {
                emoji: '📥',
                color: chalk.magenta,
                label: 'MODULE'
            },
            'MODULE_UNLOAD': {
                emoji: '📤',
                color: chalk.yellow,
                label: 'MODULE'
            },
            
            // 이벤트 관련
            'EVENT': {
                emoji: '📢',
                color: chalk.cyan,
                label: 'EVENT'
            },
            'COMMAND': {
                emoji: '💬',
                color: chalk.blue,
                label: 'COMMAND'
            },
            'BUTTON': {
                emoji: '🔘',
                color: chalk.blue,
                label: 'BUTTON'
            },
            'DROPDOWN': {
                emoji: '📋',
                color: chalk.blue,
                label: 'DROPDOWN'
            },
            
            // 웹 관련
            'WEB': {
                emoji: '🌐',
                color: chalk.cyan,
                label: 'WEB'
            },
            'API': {
                emoji: '🔌',
                color: chalk.cyan,
                label: 'API'
            },
            
            // 데이터베이스 관련
            'DATABASE': {
                emoji: '🗄️',
                color: chalk.green,
                label: 'DATABASE'
            },
            'CACHE': {
                emoji: '💾',
                color: chalk.gray,
                label: 'CACHE'
            },
            
            // 경고 및 에러
            'WARNING': {
                emoji: '⚠️',
                color: chalk.yellow,
                label: 'WARNING'
            },
            'ERROR': {
                emoji: '❌',
                color: chalk.red,
                label: 'ERROR'
            },
            'CRITICAL': {
                emoji: '🚨',
                color: chalk.red.bold.underline,
                label: 'CRITICAL'
            },
            
            // 디버그
            'DEBUG': {
                emoji: '🔍',
                color: chalk.gray,
                label: 'DEBUG'
            },
            
            // 보안
            'SECURITY': {
                emoji: '🔒',
                color: chalk.yellow.bold,
                label: 'SECURITY'
            },
            
            // 성능
            'PERFORMANCE': {
                emoji: '⚡',
                color: chalk.yellow,
                label: 'PERFORMANCE'
            }
        };

        const levelConfig = levels[level] || levels['INFO'];
        const { emoji, color, label } = levelConfig;
        
        // 추가 인자들을 문자열로 변환
        const extraInfo = args.length > 0 ? chalk.gray(` | ${args.join(' | ')}`) : '';
        
        return `${emoji} ${color(`[${label}]`)} ${message}${extraInfo}`;
    }

    // 편의 메서드들
    system(message, ...args) {
        this.log('SYSTEM', message, ...args);
    }

    startup(message, ...args) {
        this.log('STARTUP', message, ...args);
    }

    ready(message, ...args) {
        this.log('READY', message, ...args);
    }

    info(message, ...args) {
        this.log('INFO', message, ...args);
    }

    success(message, ...args) {
        this.log('SUCCESS', message, ...args);
    }

    module(message, ...args) {
        this.log('MODULE', message, ...args);
    }

    moduleLoad(message, ...args) {
        this.log('MODULE_LOAD', message, ...args);
    }

    moduleUnload(message, ...args) {
        this.log('MODULE_UNLOAD', message, ...args);
    }

    event(message, ...args) {
        this.log('EVENT', message, ...args);
    }

    command(message, ...args) {
        this.log('COMMAND', message, ...args);
    }

    button(message, ...args) {
        this.log('BUTTON', message, ...args);
    }

    dropdown(message, ...args) {
        this.log('DROPDOWN', message, ...args);
    }

    web(message, ...args) {
        this.log('WEB', message, ...args);
    }

    api(message, ...args) {
        this.log('API', message, ...args);
    }

    database(message, ...args) {
        this.log('DATABASE', message, ...args);
    }

    cache(message, ...args) {
        this.log('CACHE', message, ...args);
    }

    warning(message, ...args) {
        this.log('WARNING', message, ...args);
    }

    error(message, ...args) {
        this.log('ERROR', message, ...args);
    }

    critical(message, ...args) {
        this.log('CRITICAL', message, ...args);
    }

    debug(message, ...args) {
        if (process.env.DEBUG === 'true') {
            this.log('DEBUG', message, ...args);
        }
    }

    security(message, ...args) {
        this.log('SECURITY', message, ...args);
    }

    performance(message, ...args) {
        this.log('PERFORMANCE', message, ...args);
    }

    // 테이블 형식 출력
    table(data, title = '') {
        if (title) {
            console.log(chalk.bold.underline(`\n${title}`));
        }
        console.table(data);
    }

    // 구분선
    separator(char = '─', length = 50) {
        console.log(chalk.gray(char.repeat(length)));
    }

    // 배너
    banner(text) {
        const border = '═'.repeat(text.length + 4);
        console.log(chalk.cyan(`╔${border}╗`));
        console.log(chalk.cyan(`║  ${chalk.bold(text)}  ║`));
        console.log(chalk.cyan(`╚${border}╝`));
    }
}

module.exports = new Logger();