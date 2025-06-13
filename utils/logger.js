// ========================================
// utils/logger.js - 개선된 버전
// ========================================
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logTypes = {
            // 시스템 관련
            SYSTEM: { color: chalk.cyan, emoji: '🔧', label: 'SYSTEM' },
            STARTUP: { color: chalk.magenta, emoji: '🚀', label: 'STARTUP' },
            READY: { color: chalk.green, emoji: '✅', label: 'READY' },
            SHUTDOWN: { color: chalk.yellow, emoji: '🛑', label: 'SHUTDOWN' },
            
            // 정보성
            INFO: { color: chalk.blue, emoji: '📢', label: 'INFO' },
            SUCCESS: { color: chalk.green, emoji: '✅', label: 'SUCCESS' },
            WARNING: { color: chalk.yellow, emoji: '⚠️', label: 'WARN' },
            ERROR: { color: chalk.red, emoji: '❌', label: 'ERROR' },
            CRITICAL: { color: chalk.bgRed, emoji: '🚨', label: 'CRITICAL' },
            
            // 모듈 관련
            MODULE: { color: chalk.magenta, emoji: '📦', label: 'MODULE' },
            MODULE_LOAD: { color: chalk.green, emoji: '📥', label: 'MODULE_LOAD' },
            MODULE_UNLOAD: { color: chalk.yellow, emoji: '📤', label: 'MODULE_UNLOAD' },
            MODULE_ERROR: { color: chalk.red, emoji: '🔴', label: 'MODULE_ERROR' },
            
            // 이벤트 관련
            EVENT: { color: chalk.cyan, emoji: '⚡', label: 'EVENT' },
            COMMAND: { color: chalk.blue, emoji: '🎮', label: 'COMMAND' },
            BUTTON: { color: chalk.green, emoji: '🔘', label: 'BUTTON' },
            DROPDOWN: { color: chalk.yellow, emoji: '📋', label: 'DROPDOWN' },
            INTERACTION: { color: chalk.magenta, emoji: '🎯', label: 'INTERACTION' },
            
            // 웹 관련
            WEB: { color: chalk.blue, emoji: '🌐', label: 'WEB' },
            API: { color: chalk.cyan, emoji: '🔌', label: 'API' },
            ROUTE: { color: chalk.green, emoji: '🛣️', label: 'ROUTE' },
            AUTH: { color: chalk.yellow, emoji: '🔐', label: 'AUTH' },
            SESSION: { color: chalk.magenta, emoji: '🔑', label: 'SESSION' },
            
            // 데이터 관련
            DATABASE: { color: chalk.green, emoji: '💾', label: 'DATABASE' },
            CACHE: { color: chalk.cyan, emoji: '💿', label: 'CACHE' },
            FILE: { color: chalk.blue, emoji: '📁', label: 'FILE' },
            SAVE: { color: chalk.green, emoji: '💾', label: 'SAVE' },
            LOAD: { color: chalk.yellow, emoji: '📂', label: 'LOAD' },
            
            // 보안 관련
            SECURITY: { color: chalk.red, emoji: '🔒', label: 'SECURITY' },
            PERMISSION: { color: chalk.yellow, emoji: '🛡️', label: 'PERMISSION' },
            ACCESS: { color: chalk.blue, emoji: '🚪', label: 'ACCESS' },
            
            // 성능 관련
            PERFORMANCE: { color: chalk.magenta, emoji: '⚡', label: 'PERFORMANCE' },
            MEMORY: { color: chalk.cyan, emoji: '🧠', label: 'MEMORY' },
            CPU: { color: chalk.yellow, emoji: '💻', label: 'CPU' },
            
            // 네트워크 관련
            NETWORK: { color: chalk.blue, emoji: '🌍', label: 'NETWORK' },
            REQUEST: { color: chalk.green, emoji: '📨', label: 'REQUEST' },
            RESPONSE: { color: chalk.cyan, emoji: '📬', label: 'RESPONSE' },
            
            // Discord 관련
            DISCORD: { color: chalk.hex('#5865F2'), emoji: '💬', label: 'DISCORD' },
            GUILD: { color: chalk.green, emoji: '🏰', label: 'GUILD' },
            MEMBER: { color: chalk.blue, emoji: '👥', label: 'MEMBER' },
            VOICE: { color: chalk.yellow, emoji: '🎤', label: 'VOICE' },
            
            // 디버그
            DEBUG: { color: chalk.gray, emoji: '🔍', label: 'DEBUG' },
            TRACE: { color: chalk.dim, emoji: '🔎', label: 'TRACE' }
        };
        
        this.history = [];
        this.maxHistory = 1000;
        
        // 로그 파일 설정
        this.logDir = path.join(process.cwd(), 'logs');
        this.ensureLogDirectory();
    }
    
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    getTimestamp() {
        return new Date().toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    log(type, message, ...args) {
        const logType = this.logTypes[type] || this.logTypes.INFO;
        const timestamp = this.getTimestamp();
        const formattedMessage = this.formatMessage(logType, message, args);
        
        // 콘솔 출력
        console.log(formattedMessage);
        
        // 히스토리 저장
        this.addToHistory({
            timestamp,
            type,
            message,
            args
        });
        
        // 파일 저장
        this.saveToFile(timestamp, type, message, args);
    }
    
    formatMessage(logType, message, args = []) {
        const { emoji, color, label } = logType;
        const timestamp = `[${this.getTimestamp()}]`;
        const extraInfo = args.length > 0 ? chalk.gray(` | ${args.join(' | ')}`) : '';
        
        return `${timestamp} ${emoji} ${color(`[${label}]`)} ${message}${extraInfo}`;
    }
    
    addToHistory(entry) {
        this.history.push(entry);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    getHistory(type = null, limit = 100) {
        let filtered = this.history;
        
        if (type) {
            filtered = this.history.filter(entry => entry.type === type);
        }
        
        return filtered.slice(-limit);
    }
    
    saveToFile(timestamp, type, message, args) {
        const date = new Date().toISOString().split('T')[0];
        const filename = path.join(this.logDir, `${date}.log`);
        const logEntry = `[${timestamp}] [${type}] ${message} ${args.join(' ')}\n`;
        
        fs.appendFile(filename, logEntry, (err) => {
            if (err) {
                console.error('로그 파일 저장 실패:', err);
            }
        });
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
    
    shutdown(message, ...args) {
        this.log('SHUTDOWN', message, ...args);
    }
    
    info(message, ...args) {
        this.log('INFO', message, ...args);
    }
    
    success(message, ...args) {
        this.log('SUCCESS', message, ...args);
    }
    
    warning(message, ...args) {
        this.log('WARNING', message, ...args);
    }
    
    warn(message, ...args) {
        this.warning(message, ...args);
    }
    
    error(message, ...args) {
        this.log('ERROR', message, ...args);
    }
    
    critical(message, ...args) {
        this.log('CRITICAL', message, ...args);
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
    
    moduleError(message, ...args) {
        this.log('MODULE_ERROR', message, ...args);
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
    
    interaction(message, ...args) {
        this.log('INTERACTION', message, ...args);
    }
    
    web(message, ...args) {
        this.log('WEB', message, ...args);
    }
    
    api(message, ...args) {
        this.log('API', message, ...args);
    }
    
    route(message, ...args) {
        this.log('ROUTE', message, ...args);
    }
    
    auth(message, ...args) {
        this.log('AUTH', message, ...args);
    }
    
    session(message, ...args) {
        this.log('SESSION', message, ...args);
    }
    
    database(message, ...args) {
        this.log('DATABASE', message, ...args);
    }
    
    cache(message, ...args) {
        this.log('CACHE', message, ...args);
    }
    
    file(message, ...args) {
        this.log('FILE', message, ...args);
    }
    
    save(message, ...args) {
        this.log('SAVE', message, ...args);
    }
    
    load(message, ...args) {
        this.log('LOAD', message, ...args);
    }
    
    security(message, ...args) {
        this.log('SECURITY', message, ...args);
    }
    
    permission(message, ...args) {
        this.log('PERMISSION', message, ...args);
    }
    
    access(message, ...args) {
        this.log('ACCESS', message, ...args);
    }
    
    performance(message, ...args) {
        this.log('PERFORMANCE', message, ...args);
    }
    
    memory(message, ...args) {
        this.log('MEMORY', message, ...args);
    }
    
    cpu(message, ...args) {
        this.log('CPU', message, ...args);
    }
    
    network(message, ...args) {
        this.log('NETWORK', message, ...args);
    }
    
    request(message, ...args) {
        this.log('REQUEST', message, ...args);
    }
    
    response(message, ...args) {
        this.log('RESPONSE', message, ...args);
    }
    
    discord(message, ...args) {
        this.log('DISCORD', message, ...args);
    }
    
    guild(message, ...args) {
        this.log('GUILD', message, ...args);
    }
    
    member(message, ...args) {
        this.log('MEMBER', message, ...args);
    }
    
    voice(message, ...args) {
        this.log('VOICE', message, ...args);
    }
    
    debug(message, ...args) {
        if (process.env.DEBUG === 'true') {
            this.log('DEBUG', message, ...args);
        }
    }
    
    trace(message, ...args) {
        if (process.env.TRACE === 'true') {
            this.log('TRACE', message, ...args);
        }
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
    banner(text, color = chalk.cyan) {
        const border = '═'.repeat(text.length + 4);
        console.log(color(`╔${border}╗`));
        console.log(color(`║  ${chalk.bold(text)}  ║`));
        console.log(color(`╚${border}╝`));
    }
    
    // 프로그레스 바
    progress(current, total, label = '') {
        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((current / total) * 20);
        const empty = 20 - filled;
        const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
        const message = `${label} [${bar}] ${percentage}% (${current}/${total})`;
        
        // 같은 줄에 업데이트
        process.stdout.write(`\r${message}`);
        
        if (current === total) {
            console.log(); // 완료 시 줄바꿈
        }
    }
    
    // 박스 출력
    box(content, title = '', color = chalk.white) {
        const lines = content.split('\n');
        const maxLength = Math.max(...lines.map(line => line.length), title.length);
        const width = maxLength + 4;
        
        console.log(color(`┌${'─'.repeat(width)}┐`));
        
        if (title) {
            const padding = Math.floor((width - title.length - 2) / 2);
            console.log(color(`│${' '.repeat(padding)}${chalk.bold(title)}${' '.repeat(width - padding - title.length - 2)}│`));
            console.log(color(`├${'─'.repeat(width)}┤`));
        }
        
        lines.forEach(line => {
            const padding = width - line.length - 2;
            console.log(color(`│ ${line}${' '.repeat(padding)} │`));
        });
        
        console.log(color(`└${'─'.repeat(width)}┘`));
    }
}

module.exports = new Logger();