// ========================================
// web/routes/apiRoutes.js
// ========================================
const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const dataManager = require('../../utils/dataManager');
const eventBus = require('../../utils/eventBus');
const { ROLES, requireAuth, requireRole } = require('../utils/permissions');

// 봇 상태 API
router.get('/bot/status', async (req, res) => {
    try {
        const BotClientManager = require('../../utils/botClientManager');
        const botClient = BotClientManager.getClient();
        
        const status = {
            online: botClient.ws.status === 0,
            ping: botClient.ws.ping,
            uptime: process.uptime(),
            guilds: botClient.guilds.cache.size,
            users: botClient.users.cache.size,
            memory: process.memoryUsage()
        };
        
        res.json(status);
    } catch (error) {
        logger.error(`봇 상태 API 오류: ${error.message}`);
        res.status(500).json({ error: '봇 상태를 가져올 수 없습니다.' });
    }
});

// 봇 제어 API (관리자 전용)
router.post('/bot/control', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { action } = req.body;
        
        if (!['restart', 'stop'].includes(action)) {
            return res.status(400).json({ 
                success: false, 
                error: '잘못된 액션입니다.' 
            });
        }
        
        logger.warn(`🔧 봇 제어: ${action} by ${req.user.username}`);
        
        if (action === 'restart') {
            res.json({ success: true, message: '봇을 재시작합니다...' });
            
            setTimeout(() => {
                logger.warn('🔄 봇 재시작 중...');
                process.exit(0); // PM2나 nodemon이 자동으로 재시작
            }, 1000);
        } else if (action === 'stop') {
            res.json({ success: true, message: '봇을 종료합니다...' });
            
            setTimeout(() => {
                logger.warn('🛑 봇 종료 중...');
                process.exit(0);
            }, 1000);
        }
    } catch (error) {
        logger.error(`봇 제어 API 오류: ${error.message}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 로그 API (관리자 전용)
router.get('/logs', requireRole(ROLES.ADMIN), (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const level = req.query.level || null;
        
        const logs = logger.getHistory(level, limit);
        res.json(logs);
    } catch (error) {
        logger.error(`로그 API 오류: ${error.message}`);
        res.status(500).json({ error: '로그를 가져올 수 없습니다.' });
    }
});

// 통계 API
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const BotClientManager = require('../../utils/botClientManager');
        const botClient = BotClientManager.getClient();
        
        const stats = {
            bot: {
                guilds: botClient.guilds.cache.size,
                users: botClient.users.cache.size,
                channels: botClient.channels.cache.size,
                uptime: process.uptime(),
                memory: process.memoryUsage()
            },
            data: await dataManager.getStats()
        };
        
        res.json(stats);
    } catch (error) {
        logger.error(`통계 API 오류: ${error.message}`);
        res.status(500).json({ error: '통계를 가져올 수 없습니다.' });
    }
});

// 사용자 정보 API
router.get('/user/:userId', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // 일반 사용자는 자신의 정보만 조회 가능
        if (req.user.id !== userId && !req.isAdmin) {
            return res.status(403).json({ error: '권한이 없습니다.' });
        }
        
        const userData = await dataManager.read(`user_${userId}`);
        if (!userData) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json(userData);
    } catch (error) {
        logger.error(`사용자 정보 API 오류: ${error.message}`);
        res.status(500).json({ error: '사용자 정보를 가져올 수 없습니다.' });
    }
});

// 서버 목록 API (관리자 전용)
router.get('/guilds', requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const BotClientManager = require('../../utils/botClientManager');
        const botClient = BotClientManager.getClient();
        
        const guilds = botClient.guilds.cache.map(guild => ({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            memberCount: guild.memberCount,
            owner: guild.owner?.user.tag || 'Unknown',
            joinedAt: guild.joinedTimestamp,
            createdAt: guild.createdTimestamp,
            boostLevel: guild.premiumTier,
            boostCount: guild.premiumSubscriptionCount
        }));
        
        res.json(guilds);
    } catch (error) {
        logger.error(`서버 목록 API 오류: ${error.message}`);
        res.status(500).json({ error: '서버 목록을 가져올 수 없습니다.' });
    }
});

// 헬스체크 API
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;