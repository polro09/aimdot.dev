// ========================================
// web/utils/permissions.js - 개선된 버전
// ========================================
const dataManager = require('../../utils/dataManager');
const logger = require('../../utils/logger');
const config = require('../../config');

// 권한 레벨 정의
const ROLES = {
    GUEST: 'guest',
    MEMBER: 'member',
    ADMIN: 'admin'
};

// 권한 계층 구조
const ROLE_HIERARCHY = {
    [ROLES.ADMIN]: 3,
    [ROLES.MEMBER]: 2,
    [ROLES.GUEST]: 1
};

class PermissionManager {
    constructor() {
        this.permissions = {
            userRoles: {},
            pagePermissions: {
                '/': ROLES.GUEST,
                '/party': ROLES.MEMBER,
                '/dashboard': ROLES.ADMIN,
                '/admin/permissions': ROLES.ADMIN,
                '/servers': ROLES.ADMIN,
                '/logs': ROLES.ADMIN,
                '/settings': ROLES.ADMIN
            }
        };
        
        // 권한 캐시 (메모리 캐싱)
        this.roleCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5분
        
        this.loadPermissions();
    }
    
    async loadPermissions() {
        try {
            const savedPermissions = await dataManager.read('web_permissions');
            if (savedPermissions) {
                this.permissions = { ...this.permissions, ...savedPermissions };
                logger.permission('권한 데이터 로드 완료');
            }
            
            // 관리자 ID 자동 설정
            if (config.bot.adminIds && config.bot.adminIds.length > 0) {
                config.bot.adminIds.forEach(adminId => {
                    this.permissions.userRoles[adminId] = ROLES.ADMIN;
                });
            }
            
            await this.savePermissions();
        } catch (error) {
            logger.error(`권한 로드 오류: ${error.message}`);
        }
    }
    
    async savePermissions() {
        try {
            await dataManager.write('web_permissions', this.permissions);
            logger.permission('권한 데이터 저장 완료');
            this.clearCache(); // 캐시 초기화
        } catch (error) {
            logger.error(`권한 저장 오류: ${error.message}`);
        }
    }
    
    getUserRole(userId) {
        // 캐시 확인
        const cached = this.getCached(userId);
        if (cached !== null) {
            return cached;
        }
        
        // 권한 확인
        const role = this.permissions.userRoles[userId] || ROLES.GUEST;
        
        // 캐시에 저장
        this.setCache(userId, role);
        
        return role;
    }
    
    async setUserRole(userId, role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error(`유효하지 않은 권한: ${role}`);
        }
        
        this.permissions.userRoles[userId] = role;
        await this.savePermissions();
        
        logger.permission(`사용자 권한 변경: ${userId} -> ${role}`);
    }
    
    hasPermission(userRole, requiredRole) {
        const userLevel = ROLE_HIERARCHY[userRole] || 0;
        const requiredLevel = ROLE_HIERARCHY[requiredRole] || 999;
        
        return userLevel >= requiredLevel;
    }
    
    canAccessPage(userId, path) {
        const userRole = this.getUserRole(userId);
        const requiredRole = this.permissions.pagePermissions[path];
        
        if (!requiredRole) {
            return true; // 권한 설정이 없는 페이지는 모두 접근 가능
        }
        
        return this.hasPermission(userRole, requiredRole);
    }
    
    async setPagePermission(path, role) {
        if (!Object.values(ROLES).includes(role)) {
            throw new Error(`유효하지 않은 권한: ${role}`);
        }
        
        this.permissions.pagePermissions[path] = role;
        await this.savePermissions();
        
        logger.permission(`페이지 권한 변경: ${path} -> ${role}`);
    }
    
    async getAllUsers() {
        const users = [];
        const files = await require('fs').promises.readdir(require('path').join(process.cwd(), 'data'));
        
        for (const file of files) {
            if (file.startsWith('user_') && file.endsWith('.json')) {
                const userId = file.replace('user_', '').replace('.json', '');
                const userData = await dataManager.read(`user_${userId}`);
                if (userData) {
                    users.push({
                        ...userData,
                        role: this.getUserRole(userData.id)
                    });
                }
            }
        }
        
        return users;
    }
    
    getStats() {
        const userRoles = this.permissions.userRoles;
        const stats = {
            total: Object.keys(userRoles).length,
            admins: Object.values(userRoles).filter(role => role === ROLES.ADMIN).length,
            members: Object.values(userRoles).filter(role => role === ROLES.MEMBER).length,
            guests: Object.values(userRoles).filter(role => role === ROLES.GUEST).length
        };
        
        return stats;
    }
    
    // 캐시 관리 메서드
    getCached(userId) {
        const cached = this.roleCache.get(userId);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.role;
        }
        return null;
    }
    
    setCache(userId, role) {
        this.roleCache.set(userId, {
            role,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.roleCache.clear();
    }
    
    // 권한 일괄 업데이트
    async batchUpdateRoles(updates) {
        for (const { userId, role } of updates) {
            this.permissions.userRoles[userId] = role;
        }
        await this.savePermissions();
        logger.permission(`권한 일괄 업데이트: ${updates.length}개`);
    }
    
    // 권한 내보내기/가져오기
    async exportPermissions() {
        return {
            version: '1.0',
            exported: new Date().toISOString(),
            permissions: this.permissions
        };
    }
    
    async importPermissions(data) {
        if (data.version !== '1.0') {
            throw new Error('호환되지 않는 권한 데이터 버전');
        }
        
        this.permissions = data.permissions;
        await this.savePermissions();
        logger.permission('권한 데이터 가져오기 완료');
    }
}

// 싱글톤 인스턴스
const permissionManager = new PermissionManager();

// 미들웨어 함수들
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        // 권한 캐싱
        if (!req.userRole) {
            req.userRole = permissionManager.getUserRole(req.user.id);
        }
        return next();
    }
    
    req.session.returnTo = req.originalUrl;
    logger.access(`인증 필요: ${req.originalUrl}`);
    res.redirect('/login');
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            req.session.returnTo = req.originalUrl;
            return res.redirect('/login');
        }
        
        const userRole = req.userRole || permissionManager.getUserRole(req.user.id);
        req.userRole = userRole;
        
        if (permissionManager.hasPermission(userRole, role)) {
            logger.access(`접근 허용: ${req.user.username} (${userRole}) -> ${req.path}`);
            return next();
        }
        
        logger.security(`접근 거부: ${req.user.username} (${userRole}) -> ${req.path}`);
        res.status(403).render('error', { 
            error: '접근 권한이 없습니다.',
            user: req.user,
            userRole: userRole
        });
    };
}

function checkPagePermission(req, res, next) {
    if (!req.isAuthenticated()) {
        return next();
    }
    
    const userRole = req.userRole || permissionManager.getUserRole(req.user.id);
    req.userRole = userRole;
    
    if (permissionManager.canAccessPage(req.user.id, req.path)) {
        return next();
    }
    
    logger.security(`페이지 접근 거부: ${req.user.username} -> ${req.path}`);
    res.status(403).render('error', { 
        error: '이 페이지에 접근할 권한이 없습니다.',
        user: req.user,
        userRole: userRole
    });
}

// 권한 확인 헬퍼 함수
function isAdmin(userId) {
    return permissionManager.getUserRole(userId) === ROLES.ADMIN;
}

function isMember(userId) {
    const role = permissionManager.getUserRole(userId);
    return role === ROLES.MEMBER || role === ROLES.ADMIN;
}

module.exports = {
    ROLES,
    ROLE_HIERARCHY,
    permissionManager,
    requireAuth,
    requireRole,
    checkPagePermission,
    isAdmin,
    isMember
};