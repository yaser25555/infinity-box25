/**
 * Player Header Component - عرض معلومات اللاعب في جميع الألعاب
 */

class PlayerHeader {
    constructor() {
        this.username = '';
        this.balance = 0;
        this.pearls = 0;
        this.playerId = '';
        this.avatar = '';
        this.initialized = false;
    }

    /**
     * إنشاء HTML للهيدر
     */
    createHeaderHTML() {
        return `
            <div class="player-header-container">
                <div class="player-info-section">
                    <div class="player-avatar-container">
                        <div class="player-avatar" id="player-avatar">
                            <img id="player-avatar-img" src="images/default-avatar.png" alt="Player Avatar" style="display: none;">
                            <span id="player-avatar-icon">👤</span>
                        </div>
                    </div>
                    <div class="player-details">
                        <div class="player-name">
                            <span id="username-display">${this.username || 'لاعب'}</span>
                            <span class="player-id" id="player-id-display">${this.playerId ? `#${this.playerId}` : ''}</span>
                        </div>
                        <div class="player-balance">
                            <span class="balance-icon">💰</span>
                            <span id="balance-display">${this.balance || 0}</span>
                            <span class="balance-currency">عملة</span>
                        </div>
                    </div>
                </div>
                <div class="player-actions">
                    <button onclick="goToMainPage()" class="action-btn home-btn" title="العودة للصفحة الرئيسية">
                        🏠
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * إنشاء CSS للهيدر
     */
    createHeaderCSS() {
        return `
            <style>
                .player-header-container {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
                    backdrop-filter: blur(25px);
                    border-radius: 20px;
                    border: 2px solid rgba(255, 215, 0, 0.3);
                    padding: 15px 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                }

                .player-info-section {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .player-avatar-container {
                    position: relative;
                }

                .player-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 0 5px 15px rgba(255, 215, 0, 0.3);
                    overflow: hidden;
                    position: relative;
                }

                .player-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                    transition: all 0.3s ease;
                    position: absolute;
                    top: 0;
                    left: 0;
                    z-index: 2;
                }

                .player-avatar-icon {
                    font-size: 1.5em;
                    color: #333;
                    font-weight: bold;
                    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
                }

                .player-details {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .player-name {
                    font-size: 1.1em;
                    font-weight: bold;
                    color: #fff;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .player-id {
                    font-size: 0.8em;
                    color: #ffd700;
                    font-weight: normal;
                    opacity: 0.8;
                }

                .player-balance {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.9em;
                    color: #ffd700;
                    font-weight: bold;
                }

                .balance-icon {
                    font-size: 1.1em;
                }

                .balance-currency {
                    color: #ccc;
                    font-size: 0.8em;
                }

                .player-actions {
                    display: flex;
                    gap: 10px;
                }

                .action-btn {
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    border: 2px solid rgba(255, 215, 0, 0.6);
                    background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
                    color: #fff;
                    font-size: 1.2em;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                }

                .action-btn:hover {
                    transform: scale(1.1);
                    box-shadow: 0 8px 25px rgba(255, 215, 0, 0.5);
                }

                .home-btn {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                }

                /* تحسينات للشاشات الصغيرة */
                @media (max-width: 768px) {
                    .player-header-container {
                        padding: 12px 15px;
                        margin-bottom: 15px;
                    }

                    .player-avatar {
                        width: 40px;
                        height: 40px;
                    }

                    .player-avatar-icon {
                        font-size: 1.2em;
                    }

                    .player-name {
                        font-size: 1em;
                    }

                    .player-balance {
                        font-size: 0.8em;
                    }

                    .action-btn {
                        width: 40px;
                        height: 40px;
                        font-size: 1em;
                    }

                    .player-info-section {
                        gap: 10px;
                    }

                    .player-actions {
                        gap: 8px;
                    }
                }

                @media (max-width: 480px) {
                    .player-header-container {
                        padding: 10px 12px;
                    }

                    .player-avatar {
                        width: 35px;
                        height: 35px;
                    }

                    .player-name {
                        font-size: 0.9em;
                    }

                    .player-balance {
                        font-size: 0.75em;
                    }

                    .action-btn {
                        width: 35px;
                        height: 35px;
                        font-size: 0.9em;
                    }
                }
            </style>
        `;
    }

    /**
     * تهيئة الهيدر
     */
    async init() {
        if (this.initialized) return;

        // إضافة CSS
        const style = document.createElement('style');
        style.innerHTML = this.createHeaderCSS().replace('<style>', '').replace('</style>', '');
        document.head.appendChild(style);

        // تحميل بيانات اللاعب
        await this.loadPlayerData();

        // بدء التحديث الدوري
        this.startPeriodicUpdate();

        this.initialized = true;
    }

    /**
     * إدراج الهيدر في الصفحة
     */
    insertHeader(targetElement) {
        if (!targetElement) {
            console.error('❌ لم يتم العثور على العنصر المستهدف لإدراج الهيدر');
            return;
        }

        const headerHTML = this.createHeaderHTML();
        targetElement.insertAdjacentHTML('afterbegin', headerHTML);

        // تحديث البيانات بعد الإدراج
        this.updateDisplay();
    }

    /**
     * تحميل بيانات اللاعب
     */
    async loadPlayerData() {
        try {
            // محاولة الحصول على البيانات من API
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await fetch('/api/users/profile', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        this.username = data.username || 'لاعب';
                        this.balance = data.coins || data.goldCoins || data.balance || 0;
                        this.playerId = data.playerId || data._id || data.id || '';
                        this.avatar = data.profileImage || data.avatar || '';
                        console.log('✅ تم تحميل بيانات اللاعب من API:', {
                            username: this.username,
                            balance: this.balance,
                            playerId: this.playerId,
                            avatar: this.avatar ? 'موجود' : 'غير موجود'
                        });
                        return;
                    }
                } catch (apiError) {
                    console.warn('⚠️ فشل في تحميل البيانات من API:', apiError);
                }
            }

            // محاولة الحصول على البيانات من النظام الاقتصادي
            if (window.gameEconomy) {
                const playerData = await window.gameEconomy.getPlayerData();
                if (playerData) {
                    this.username = playerData.username || 'لاعب';
                    this.balance = playerData.balance || 0;
                    this.playerId = playerData.playerId || '';
                    this.avatar = playerData.avatar || '';
                    console.log('✅ تم تحميل بيانات اللاعب من النظام الاقتصادي');
                    return;
                }
            }

            // محاولة الحصول على البيانات من localStorage
            const userData = localStorage.getItem('userData');
            if (userData) {
                const data = JSON.parse(userData);
                this.username = data.username || 'لاعب';
                this.balance = data.balance || data.coins || 0;
                this.playerId = data.playerId || data.id || '';
                this.avatar = data.avatar || '';
                console.log('✅ تم تحميل بيانات اللاعب من localStorage');
                return;
            }

            // بيانات افتراضية
            this.username = 'لاعب تجريبي';
            this.balance = 1000;
            console.log('⚠️ استخدام بيانات افتراضية');

        } catch (error) {
            console.error('❌ خطأ في تحميل بيانات اللاعب:', error);
            this.username = 'لاعب';
            this.balance = 0;
        }
    }

    /**
     * تحديث عرض البيانات
     */
    updateDisplay() {
        const usernameDisplay = document.getElementById('username-display');
        const balanceDisplay = document.getElementById('balance-display');
        const playerIdDisplay = document.getElementById('player-id-display');

        if (usernameDisplay) {
            usernameDisplay.textContent = this.username;
        }

        if (balanceDisplay) {
            balanceDisplay.textContent = Math.round(this.balance);
        }

        if (playerIdDisplay) {
            playerIdDisplay.textContent = this.playerId ? `#${this.playerId}` : '';
        }

        this.updatePlayerAvatar();
    }

    /**
     * تحديث صورة اللاعب
     */
    updatePlayerAvatar() {
        const avatarImg = document.getElementById('player-avatar-img');
        const avatarIcon = document.getElementById('player-avatar-icon');

        if (this.avatar && this.avatar.trim() !== '') {
            if (avatarImg) {
                // التحقق من صحة رابط الصورة
                const img = new Image();
                img.onload = () => {
                    avatarImg.src = this.avatar;
                    avatarImg.style.display = 'block';
                    if (avatarIcon) avatarIcon.style.display = 'none';
                    console.log('✅ تم تحميل صورة اللاعب بنجاح:', this.avatar.substring(0, 50) + '...');
                };
                img.onerror = () => {
                    console.warn('⚠️ فشل في تحميل صورة اللاعب، استخدام الأيقونة الافتراضية');
                    this.showDefaultAvatar(avatarIcon, avatarImg);
                };

                // إضافة timeout للتحقق من تحميل الصورة
                setTimeout(() => {
                    if (!img.complete || img.naturalWidth === 0) {
                        console.warn('⚠️ انتهت مهلة تحميل الصورة، استخدام الأيقونة الافتراضية');
                        this.showDefaultAvatar(avatarIcon, avatarImg);
                    }
                }, 5000);

                img.src = this.avatar;
            }
        } else {
            this.showDefaultAvatar(avatarIcon, avatarImg);
        }
    }

    /**
     * عرض الأيقونة الافتراضية
     */
    showDefaultAvatar(avatarIcon, avatarImg) {
        if (avatarIcon) {
            avatarIcon.style.display = 'block';
            avatarIcon.textContent = this.username ? this.username.charAt(0).toUpperCase() : '👤';
        }
        if (avatarImg) {
            avatarImg.style.display = 'none';
        }
    }

    /**
     * تحديث الرصيد
     */
    updateBalance(newBalance) {
        if (typeof newBalance === 'object') {
            // إذا كان الرصيد كائن يحتوي على gold و pearls
            this.balance = newBalance.gold || newBalance.balance || 0;
            this.pearls = newBalance.pearls || 0;
        } else {
            // إذا كان الرصيد رقم
            this.balance = newBalance || 0;
        }

        const balanceDisplay = document.getElementById('balance-display');
        if (balanceDisplay) {
            balanceDisplay.textContent = Math.round(this.balance);
        }
    }

    /**
     * الحصول على الرصيد الحالي
     */
    getBalance() {
        return {
            gold: this.balance || 0,
            pearls: this.pearls || 0,
            balance: this.balance || 0
        };
    }

    /**
     * تحديث البيانات من الخادم
     */
    async refreshPlayerData() {
        await this.loadPlayerData();
        this.updateDisplay();
    }

    /**
     * بدء التحديث الدوري للبيانات
     */
    startPeriodicUpdate(intervalMs = 30000) { // كل 30 ثانية
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(async () => {
            try {
                await this.refreshPlayerData();
                console.log('🔄 تم تحديث بيانات اللاعب تلقائياً');
            } catch (error) {
                console.error('❌ خطأ في التحديث التلقائي:', error);
            }
        }, intervalMs);

        // بدء التحقق الدوري من صحة الرصيد
        this.startBalanceValidation(60000); // كل دقيقة
    }

    /**
     * بدء التحقق الدوري من صحة الرصيد
     */
    startBalanceValidation(intervalMs = 60000) { // كل دقيقة
        if (this.balanceValidationInterval) {
            clearInterval(this.balanceValidationInterval);
        }

        this.balanceValidationInterval = setInterval(async () => {
            try {
                await this.validateBalanceWithServer();
            } catch (error) {
                console.error('❌ خطأ في التحقق من الرصيد:', error);
            }
        }, intervalMs);
    }

    /**
     * التحقق من صحة الرصيد مع الخادم
     */
    async validateBalanceWithServer() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const currentBalance = this.balance;
            const response = await fetch(`/api/users/balance/validate?currentBalance=${currentBalance}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.needsSync) {
                    console.warn('⚠️ اختلاف في الرصيد، يتم التصحيح:', {
                        client: data.clientBalance,
                        server: data.serverBalance,
                        difference: data.difference
                    });

                    // تحديث الرصيد المحلي
                    this.balance = data.serverBalance;
                    this.updateDisplay();

                    // تحديث النظام الاقتصادي إذا كان موجوداً
                    if (window.gameEconomy && window.gameEconomy.gameSession) {
                        window.gameEconomy.gameSession.currentBalance = data.serverBalance;
                        window.gameEconomy.saveGameSession();
                    }

                    // عرض إشعار للمستخدم
                    this.showBalanceSyncNotification(data.difference);
                }
            }
        } catch (error) {
            console.error('❌ خطأ في التحقق من الرصيد:', error);
        }
    }

    /**
     * عرض إشعار مزامنة الرصيد
     */
    showBalanceSyncNotification(difference) {
        const notification = document.createElement('div');
        notification.className = 'balance-sync-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 300px;
                font-family: Arial, sans-serif;
                animation: slideInRight 0.3s ease-out;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 20px;">🔄</span>
                    <div>
                        <div style="font-weight: bold; margin-bottom: 5px;">تم مزامنة الرصيد</div>
                        <div style="font-size: 14px; opacity: 0.9;">تم تصحيح الاختلاف: ${difference.toFixed(2)}</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // إزالة الإشعار بعد 3 ثوان
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    /**
     * إيقاف التحديث الدوري
     */
    stopPeriodicUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.balanceValidationInterval) {
            clearInterval(this.balanceValidationInterval);
            this.balanceValidationInterval = null;
        }
    }
}

// إنشاء instance عام
window.playerHeader = new PlayerHeader();

// دالة مساعدة للعودة للصفحة الرئيسية
function goToMainPage() {
    window.location.href = '/';
}


