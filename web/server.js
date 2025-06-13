// ========================================
// web/server.js - 개선된 버전
// ========================================
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const logger = require('../utils/logger');
const dataManager = require('../utils/dataManager');
const eventBus = require('../utils/eventBus');
const config = require('../config');
const { ROLES, permissionManager, requireAuth, requireRole } = require('./utils/permissions');
const os = require('os');
const fs = require('fs');

// Express 앱 초기화
const app = express();

// 세션 디렉토리 생성
const sessionsDir = path.join(__dirname, '../sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// 보안 미들웨어
app.use(helmet({
    contentSecurityPolicy: false
}));

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS 및 레이아웃 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// 요청 로깅 미들웨어
app.use((req, res, next) => {
    logger.web(`${req.method} ${req.path}`, req.ip);
    next();
});

// 세션 설정 - FileStore로 변경하여 영속성 보장
app.use(session({
    store: new FileStore({
        path: sessionsDir,
        ttl: 30 * 24 * 60 * 60, // 30일
        retries: 2,
        secret: config.web.sessionSecret
    }),
    secret: config.web.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true, // 활동 시마다 세션 갱신
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
        sameSite: 'strict'
    },
    name: 'aimdot.sid'
}));

// Passport 설정
app.use(passport.initialize());
app.use(passport.session());

// Discord OAuth2 전략 설정
passport.use(new DiscordStrategy({
    clientID: config.discord.clientId,
    clientSecret: config.discord.clientSecret,
    callbackURL: config.discord.callbackURL,
    scope: ['identify', 'guilds'],
    prompt: 'none'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const userData = {
            id: profile.id,
            username: profile.username,
            discriminator: profile.discriminator,
            avatar: profile.avatar,
            email: profile.email,
            guilds: profile.guilds,
            lastLogin: new Date().toISOString()
        };
        
        await dataManager.write(`user_${profile.id}`, userData);
        
        // 사용자 권한이 없으면 기본 권한(guest) 설정
        const currentRole = permissionManager.getUserRole(profile.id);
        if (currentRole === ROLES.GUEST && !permissionManager.permissions.userRoles[profile.id]) {
            await permissionManager.setUserRole(profile.id, ROLES.GUEST);
        }
        
        logger.auth(`Discord 로그인 성공: ${profile.username}#${profile.discriminator}`);
        return done(null, userData);
    } catch (error) {
        logger.error(`Discord 인증 오류: ${error.message}`);
        return done(error);
    }
}));

// Passport 직렬화
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await dataManager.read(`user_${id}`);
        if (!user) {
            return done(null, false);
        }
        done(null, user);
    } catch (error) {
        done(error, false);
    }
});

// 뷰 변수 미들웨어 - 개선된 버전
app.use(async (req, res, next) => {
    res.locals.user = req.user || null;
    res.locals.isAuthenticated = req.isAuthenticated();
    
    if (req.user) {
        // 캐싱을 위해 req에 저장
        if (!req.userRole) {
            req.userRole = permissionManager.getUserRole(req.user.id);
        }
        
        res.locals.userRole = req.userRole;
        res.locals.isAdmin = req.userRole === ROLES.ADMIN;
        res.locals.isMember = permissionManager.hasPermission(req.userRole, ROLES.MEMBER);
        
        logger.debug(`사용자 ${req.user.username} - 권한: ${req.userRole}`);
    } else {
        res.locals.userRole = ROLES.GUEST;
        res.locals.isAdmin = false;
        res.locals.isMember = false;
    }
    
    res.locals.config = config;
    res.locals.ROLES = ROLES;
    next();
});

// API 라우트
const apiRoutes = require('./routes/apiRoutes');
app.use('/api', apiRoutes);

// 메인 페이지
app.get('/', async (req, res) => {
    try {
        const BotClientManager = require('../utils/botClientManager');
        const botClient = BotClientManager.getClient();
        
        const publicStats = {
            guildCount: botClient.guilds.cache.size,
            userCount: botClient.users.cache.size,
            uptime: process.uptime()
        };
        
        res.render('index', { publicStats });
    } catch (error) {
        logger.error(`메인 페이지 오류: ${error.message}`);
        res.render('index', { publicStats: null });
    }
});

// 로그인 페이지
app.get('/login', (req, res) => {
    if (req.isAuthenticated()) {
        const returnTo = req.session.returnTo;
        if (returnTo) {
            delete req.session.returnTo;
            return res.redirect(returnTo);
        }
        
        const userRole = req.userRole || permissionManager.getUserRole(req.user.id);
        
        if (userRole === ROLES.ADMIN) {
            return res.redirect('/dashboard');
        } else if (userRole === ROLES.MEMBER) {
            return res.redirect('/party');
        } else {
            return res.redirect('/');
        }
    }
    res.render('login', { returnTo: req.session.returnTo });
});

// Discord OAuth2 인증 시작
app.get('/auth/discord', (req, res, next) => {
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    logger.auth('Discord OAuth2 인증 시작');
    passport.authenticate('discord')(req, res, next);
});

// Discord OAuth2 콜백
app.get('/auth/discord/callback', 
    (req, res, next) => {
        logger.auth('Discord OAuth2 콜백 수신');
        
        if (!req.query.code) {
            logger.error('OAuth2 콜백에 코드가 없습니다');
            return res.redirect('/login?error=no_code');
        }
        
        passport.authenticate('discord', { 
            failureRedirect: '/login?error=auth_failed',
            failureMessage: true 
        })(req, res, next);
    },
    (req, res) => {
        logger.auth('Discord OAuth2 인증 성공');
        
        // 세션 저장 확인
        req.session.save((err) => {
            if (err) {
                logger.error('세션 저장 실패:', err);
                return res.redirect('/login?error=session_error');
            }
            
            const userRole = permissionManager.getUserRole(req.user.id);
            
            const returnTo = req.session.returnTo;
            if (returnTo) {
                delete req.session.returnTo;
                return res.redirect(returnTo);
            }
            
            if (userRole === ROLES.ADMIN) {
                res.redirect('/dashboard');
            } else if (userRole === ROLES.MEMBER) {
                res.redirect('/party');
            } else {
                res.redirect('/');
            }
        });
    }
);

// 로그아웃
app.get('/logout', (req, res) => {
    const username = req.user ? req.user.username : 'Unknown';
    logger.auth(`웹 로그아웃: ${username}`);
    
    req.logout((err) => {
        if (err) {
            logger.error('로그아웃 오류:', err);
        }
        
        req.session.destroy((err) => {
            if (err) {
                logger.error('세션 삭제 오류:', err);
            }
            res.clearCookie('aimdot.sid');
            res.redirect('/');
        });
    });
});

// 대시보드 페이지 (관리자 전용)
app.get('/dashboard', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const BotClientManager = require('../utils/botClientManager');
        const botClient = BotClientManager.getClient();
        
        const botStatus = {
            name: botClient.user.tag,
            avatar: botClient.user.displayAvatarURL(),
            status: 'online',
            uptime: process.uptime()
        };
        
        const stats = {
            guildCount: botClient.guilds.cache.size,
            userCount: botClient.users.cache.size,
            channelCount: botClient.channels.cache.size,
            commandCount: botClient.modules ? botClient.modules.size : 0
        };
        
        const userStats = await permissionManager.getStats();
        
        const guilds = botClient.guilds.cache
            .sort((a, b) => b.memberCount - a.memberCount)
            .first(10)
            .map(guild => ({
                name: guild.name,
                memberCount: guild.memberCount,
                icon: guild.iconURL()
            }));
        
        const logs = logger.getHistory ? logger.getHistory(null, 100) : [];
        
        res.render('dashboard', { 
            botStatus,
            stats,
            userStats,
            guilds,
            logs
        });
    } catch (error) {
        logger.error(`대시보드 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 서버 목록 페이지 (관리자 전용)
app.get('/servers', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const BotClientManager = require('../utils/botClientManager');
        const botClient = BotClientManager.getClient();
        
        const guilds = botClient.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount,
            owner: guild.owner?.user.tag || 'Unknown',
            joinedAt: guild.joinedTimestamp,
            createdAt: guild.createdTimestamp
        }));
        
        res.render('servers', { guilds });
    } catch (error) {
        logger.error(`서버 목록 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 파티 라우트
const partyRoutes = require('./routes/partyRoutes');
app.use('/party', requireAuth, (req, res, next) => {
    const userRole = req.userRole || permissionManager.getUserRole(req.user.id);
    
    logger.debug(`파티 접근 시도 - 사용자: ${req.user.username}, 권한: ${userRole}`);
    
    if (!permissionManager.hasPermission(userRole, ROLES.MEMBER)) {
        return res.status(403).render('error', { 
            error: '파티 기능은 멤버 이상만 사용할 수 있습니다.'
        });
    }
    
    next();
}, partyRoutes);

// 권한 관리 페이지 (관리자 전용)
app.get('/admin/permissions', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const users = await permissionManager.getAllUsers();
        const pagePermissions = permissionManager.permissions.pagePermissions;
        
        res.render('admin/permissions', {
            users,
            pagePermissions,
            ROLES
        });
    } catch (error) {
        logger.error(`권한 관리 페이지 오류: ${error.message}`);
        res.render('error', { 
            error: '데이터를 불러오는 중 오류가 발생했습니다.'
        });
    }
});

// 권한 업데이트 API
app.post('/api/admin/permissions/user', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { userId, role } = req.body;
        
        if (userId === req.user.id) {
            return res.status(400).json({ 
                success: false, 
                error: '자신의 권한은 변경할 수 없습니다.' 
            });
        }
        
        await permissionManager.setUserRole(userId, role);
        res.json({ success: true });
    } catch (error) {
        logger.error(`권한 업데이트 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 로그 페이지 (관리자 전용)
app.get('/logs', requireRole(ROLES.ADMIN), (req, res) => {
    const logs = logger.getHistory ? logger.getHistory(null, 500) : [];
    res.render('logs', { logs });
});

// 404 처리
app.use((req, res) => {
    res.status(404).render('error', { 
        error: '페이지를 찾을 수 없습니다.'
    });
});

// 에러 처리
app.use((err, req, res, next) => {
    logger.error(`서버 오류: ${err.stack || err.message || err}`);
    
    if (res.headersSent) {
        return next(err);
    }
    
    // OAuth 에러 처리
    if (err.name === 'TokenError') {
        logger.error(`OAuth 토큰 에러: ${err.message}`);
        
        if (err.message.includes('Invalid "code"')) {
            return res.redirect('/login?error=invalid_code');
        } else if (err.message.includes('rate limited')) {
            return res.status(429).render('error', { 
                error: 'Discord 인증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
            });
        }
        
        return res.redirect('/login?error=auth_failed');
    }
    
    res.status(500).render('error', { 
        error: '서버 오류가 발생했습니다.'
    });
});

// 서버 시작 함수
async function startWebServer() {
    await permissionManager.loadPermissions();
    
    const server = app.listen(config.web.port, () => {
        logger.separator();
        logger.startup(`웹 대시보드가 시작되었습니다!`);
        logger.separator();
        
        const networkInterfaces = os.networkInterfaces();
        const addresses = [];
        
        for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            for (const interface of interfaces) {
                if (interface.family === 'IPv4' && !interface.internal) {
                    addresses.push(interface.address);
                }
            }
        }
        
        logger.info(`📍 로컬 주소: http://localhost:${config.web.port}`);
        logger.info(`📍 로컬 주소: http://127.0.0.1:${config.web.port}`);
        
        if (addresses.length > 0) {
            addresses.forEach(address => {
                logger.info(`📍 네트워크 주소: http://${address}:${config.web.port}`);
            });
        }
        
        logger.separator();
        logger.ready(`웹 대시보드 준비 완료!`);
        logger.info(`💡 팁: Ctrl+클릭으로 브라우저에서 바로 열 수 있습니다.`);
        logger.separator();
    });
    
    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            logger.error(`포트 ${config.web.port}이(가) 이미 사용 중입니다.`);
            logger.info(`💡 다른 포트를 사용하려면 .env 파일에서 WEB_PORT를 변경하세요.`);
        } else {
            logger.error(`웹 서버 오류: ${error.message}`);
        }
    });
    
    // EventBus 이벤트 구독
    eventBus.on('bot:shutdown', () => {
        logger.info('웹 서버 종료 중...');
        server.close(() => {
            logger.success('웹 서버가 안전하게 종료되었습니다.');
        });
    });
    
    return server;
}

// 설정 확인
if (!config.discord.clientId || !config.discord.clientSecret) {
    logger.error('Discord OAuth2 설정이 없습니다!');
    logger.info('💡 .env 파일에 DISCORD_CLIENT_ID와 DISCORD_CLIENT_SECRET를 설정하세요.');
} else {
    logger.info(`✅ Discord OAuth2 설정 확인: Client ID: ${config.discord.clientId.substring(0, 8)}...`);
    logger.info(`✅ Callback URL: ${config.discord.callbackURL}`);
}

module.exports = { app, startWebServer };