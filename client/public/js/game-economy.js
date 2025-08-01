/**
 * نظام الاقتصاد للألعاب - خوارزمية رياضية لمزامنة الرصيد
 * Game Economy System - Mathematical Algorithm for Balance Synchronization
 */

class GameEconomy {
    constructor() {
        this.BACKEND_URL = window.location.origin;
        this.MAX_WIN_PERCENTAGE = 0.10; // 10% حد أقصى للربح
        this.MIN_BET_AMOUNT = 10; // أقل مبلغ رهان
        this.MAX_BET_AMOUNT = 1000; // أكبر مبلغ رهان
        this.HOUSE_EDGE = 0.05; // 5% ميزة البيت
        this.playerData = null;
        this.gameSession = null;
    }

    /**
     * تهيئة جلسة اللعب
     */
    async initializeGameSession(gameType, betAmount = 0) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('يجب تسجيل الدخول أولاً');
            }

            // جلب بيانات اللاعب
            const response = await fetch(`${this.BACKEND_URL}/api/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('فشل في جلب بيانات اللاعب');
            }

            this.playerData = await response.json();
            
            // إنشاء جلسة لعب جديدة
            this.gameSession = {
                gameType: gameType,
                startTime: Date.now(),
                betAmount: betAmount,
                initialBalance: this.playerData.coins || 0,
                currentBalance: this.playerData.coins || 0,
                totalSpent: 0,
                totalWon: 0,
                gamesPlayed: 0,
                maxWinAllowed: this.calculateMaxWin(betAmount),
                sessionId: this.generateSessionId()
            };

            return this.gameSession;
        } catch (error) {
            console.error('خطأ في تهيئة جلسة اللعب:', error);
            throw error;
        }
    }

    /**
     * خوارزمية حساب الحد الأقصى للربح
     */
    calculateMaxWin(betAmount) {
        const baseWin = betAmount * (1 + this.MAX_WIN_PERCENTAGE);
        const sessionLimit = this.playerData.coins * this.MAX_WIN_PERCENTAGE;
        return Math.min(baseWin, sessionLimit);
    }

    /**
     * خوارزمية تحديد نتيجة اللعبة
     */
    calculateGameResult(playerScore, gameType, betAmount) {
        // خوارزمية رياضية لضمان عدم تجاوز حد الربح
        const randomFactor = Math.random();
        const skillFactor = this.calculateSkillFactor(playerScore, gameType);
        const economicFactor = this.calculateEconomicFactor(betAmount);
        
        // معادلة النتيجة النهائية
        const winProbability = (skillFactor * 0.6) + (randomFactor * 0.3) + (economicFactor * 0.1);
        
        // تطبيق ميزة البيت
        const adjustedProbability = winProbability * (1 - this.HOUSE_EDGE);
        
        // تحديد النتيجة
        const isWin = adjustedProbability > 0.5;
        const winAmount = isWin ? this.calculateWinAmount(betAmount, adjustedProbability) : 0;
        
        return {
            isWin: isWin,
            winAmount: winAmount,
            lossAmount: isWin ? 0 : betAmount,
            probability: adjustedProbability,
            skillFactor: skillFactor,
            economicFactor: economicFactor
        };
    }

    /**
     * حساب عامل المهارة بناءً على الأداء
     */
    calculateSkillFactor(score, gameType) {
        switch (gameType) {
            case 'speed-challenge':
                return Math.min(score / 100, 1.0); // تطبيع النقاط
            case 'mind-puzzles':
                return Math.min(score / 50, 1.0);
            case 'memory-match':
                return Math.min((100 - score) / 100, 1.0); // أقل حركات = أفضل
            case 'fruit-catching':
                return Math.min(score / 200, 1.0);
            case 'lucky-boxes':
                return 0.5; // لعبة حظ خالصة
            default:
                return 0.5;
        }
    }

    /**
     * حساب العامل الاقتصادي
     */
    calculateEconomicFactor(betAmount) {
        const balanceRatio = this.gameSession.currentBalance / this.gameSession.initialBalance;
        
        // إذا كان الرصيد منخفض، زيادة فرص الربح قليلاً
        if (balanceRatio < 0.3) {
            return 0.6;
        } else if (balanceRatio > 2.0) {
            // إذا كان الرصيد مرتفع، تقليل فرص الربح
            return 0.3;
        }
        
        return 0.5; // متوازن
    }

    /**
     * حساب مبلغ الربح
     */
    calculateWinAmount(betAmount, probability) {
        const basePayout = betAmount * (1 + (probability * this.MAX_WIN_PERCENTAGE * 2));
        const maxAllowed = this.gameSession.maxWinAllowed;
        
        return Math.min(basePayout, maxAllowed);
    }

    /**
     * بدء جلسة لعب جديدة
     */
    async startGameSession(gameType) {
        try {
            // محاولة استعادة جلسة موجودة
            if (this.loadGameSession()) {
                return this.gameSession;
            }

            // إنشاء جلسة جديدة
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('لا يوجد توكن');
            }

            // جلب الرصيد الحالي
            const response = await fetch(`${this.BACKEND_URL}/api/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('فشل في جلب بيانات المستخدم');
            }

            const userData = await response.json();
            const currentBalance = userData.goldCoins || 0;

            this.gameSession = {
                sessionId: Date.now().toString(),
                gameType: gameType,
                startTime: Date.now(),
                initialBalance: currentBalance,
                currentBalance: currentBalance,
                totalSpent: 0,
                totalWon: 0,
                gamesPlayed: 0,
                maxWinAllowed: Math.min(currentBalance * this.MAX_WIN_PERCENTAGE, 10000)
            };

            this.saveGameSession();
            return this.gameSession;
        } catch (error) {
            console.error('خطأ في بدء الجلسة:', error);
            throw error;
        }
    }

    /**
     * تحديث رصيد اللاعب مع تحسينات المزامنة
     */
    async updatePlayerBalance(result) {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('⚠️ لا يوجد توكن، تخطي تحديث الرصيد');
                return { success: false, error: 'No token' };
            }

            const balanceChange = result.isWin ? result.winAmount : -(result.lossAmount || 0);

            // إنشاء جلسة جديدة إذا لم تكن موجودة
            if (!this.gameSession) {
                await this.startGameSession(result.gameType || 'unknown');
            }

            // التحقق من الرصيد قبل التحديث
            const currentBalance = this.gameSession.currentBalance;
            const newBalance = currentBalance + balanceChange;
            
            if (newBalance < 0) {
                console.error('❌ رصيد غير كافي للعملية');
                return { success: false, error: 'Insufficient balance' };
            }

            // تحديث الجلسة المحلية
            this.gameSession.currentBalance = newBalance;
            this.gameSession.totalSpent += (result.lossAmount || 0);
            this.gameSession.totalWon += (result.winAmount || 0);
            this.gameSession.gamesPlayed++;

            // حفظ فوري في localStorage
            this.saveGameSession();

            // تحديث البيانات المحلية فوراً
            if (this.playerData) {
                this.playerData.coins = newBalance;
            }

            // تحديث الهيدر فوراً
            if (window.playerHeader && typeof window.playerHeader.updateBalance === 'function') {
                window.playerHeader.updateBalance(newBalance);
            }

            // مزامنة مع قاعدة البيانات مع إعادة المحاولة
            let retryCount = 0;
            const maxRetries = 3;
            let lastError = null;

            while (retryCount < maxRetries) {
                try {
                    const response = await fetch(`${this.BACKEND_URL}/api/users/update-balance`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            balanceChange: balanceChange,
                            gameType: this.gameSession.gameType,
                            sessionId: this.gameSession.sessionId,
                            gameResult: result,
                            currentBalance: currentBalance, // إرسال الرصيد الحالي للتحقق
                            timestamp: Date.now()
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'فشل في تحديث الرصيد');
                    }

                    const updatedData = await response.json();
                    
                    // التحقق من صحة البيانات المرجعة
                    if (updatedData.success && typeof updatedData.newBalance === 'number') {
                        // تحديث البيانات المحلية بالبيانات المؤكدة من الخادم
                        this.gameSession.currentBalance = updatedData.newBalance;
                        if (this.playerData) {
                            this.playerData.coins = updatedData.newBalance;
                        }
                        
                        // تحديث الهيدر بالبيانات المؤكدة
                        if (window.playerHeader && typeof window.playerHeader.updateBalance === 'function') {
                            window.playerHeader.updateBalance(updatedData.newBalance);
                        }

                        // حفظ الجلسة المحدثة
                        this.saveGameSession();

                        console.log('✅ تم تحديث الرصيد بنجاح:', {
                            change: balanceChange,
                            newBalance: updatedData.newBalance,
                            gameType: result.gameType
                        });

                        return {
                            success: true,
                            newBalance: updatedData.newBalance,
                            change: balanceChange,
                            confirmed: true
                        };
                    } else {
                        throw new Error('بيانات غير صحيحة من الخادم');
                    }

                } catch (error) {
                    lastError = error;
                    retryCount++;
                    console.warn(`⚠️ محاولة ${retryCount}/${maxRetries} فشلت:`, error.message);
                    
                    if (retryCount < maxRetries) {
                        // انتظار قبل إعادة المحاولة
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            }

            // إذا فشلت جميع المحاولات، استعادة الرصيد السابق
            console.error('❌ فشلت جميع محاولات تحديث الرصيد');
            this.gameSession.currentBalance = currentBalance;
            if (this.playerData) {
                this.playerData.coins = currentBalance;
            }
            this.saveGameSession();

            // تحديث الهيدر بالرصيد السابق
            if (window.playerHeader && typeof window.playerHeader.updateBalance === 'function') {
                window.playerHeader.updateBalance(currentBalance);
            }

            throw lastError;

        } catch (error) {
            console.error('❌ خطأ في تحديث الرصيد:', error);
            
            // إرسال إشعار للمستخدم
            this.showBalanceError(error.message);
            
            return {
                success: false,
                error: error.message,
                balance: this.gameSession ? this.gameSession.currentBalance : 0
            };
        }
    }

    /**
     * عرض خطأ في تحديث الرصيد
     */
    showBalanceError(message) {
        // إنشاء إشعار خطأ
        const notification = document.createElement('div');
        notification.className = 'balance-error-notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #ef4444, #dc2626);
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
                    <span style="font-size: 20px;">⚠️</span>
                    <div>
                        <div style="font-weight: bold; margin-bottom: 5px;">خطأ في تحديث الرصيد</div>
                        <div style="font-size: 14px; opacity: 0.9;">${message}</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // إزالة الإشعار بعد 5 ثوان
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * التحقق من صحة الرصيد مع الخادم
     */
    async validateBalanceWithServer() {
        try {
            const token = localStorage.getItem('token');
            if (!token) return false;

            const response = await fetch(`${this.BACKEND_URL}/api/users/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                const serverBalance = userData.coins || 0;
                const localBalance = this.gameSession ? this.gameSession.currentBalance : 0;

                // إذا كان هناك اختلاف في الرصيد
                if (Math.abs(serverBalance - localBalance) > 0.01) {
                    console.warn('⚠️ اختلاف في الرصيد:', {
                        local: localBalance,
                        server: serverBalance,
                        difference: serverBalance - localBalance
                    });

                    // تحديث الرصيد المحلي بالرصيد من الخادم
                    if (this.gameSession) {
                        this.gameSession.currentBalance = serverBalance;
                    }
                    if (this.playerData) {
                        this.playerData.coins = serverBalance;
                    }
                    this.saveGameSession();

                    // تحديث الهيدر
                    if (window.playerHeader && typeof window.playerHeader.updateBalance === 'function') {
                        window.playerHeader.updateBalance(serverBalance);
                    }

                    return true; // تم التصحيح
                }
            }
        } catch (error) {
            console.error('❌ خطأ في التحقق من الرصيد:', error);
        }

        return false;
    }

    /**
     * التحقق من إمكانية اللعب
     */
    canPlay(betAmount) {
        if (!this.gameSession) {
            return { canPlay: false, reason: 'لم يتم تهيئة الجلسة' };
        }

        if (this.gameSession.currentBalance < betAmount) {
            return { canPlay: false, reason: 'رصيد غير كافي' };
        }

        if (betAmount < this.MIN_BET_AMOUNT) {
            return { canPlay: false, reason: `الحد الأدنى للرهان ${this.MIN_BET_AMOUNT} عملة` };
        }

        if (betAmount > this.MAX_BET_AMOUNT) {
            return { canPlay: false, reason: `الحد الأقصى للرهان ${this.MAX_BET_AMOUNT} عملة` };
        }

        return { canPlay: true };
    }

    /**
     * حفظ جلسة اللعب في localStorage
     */
    saveGameSession() {
        if (this.gameSession) {
            try {
                localStorage.setItem('gameSession', JSON.stringify(this.gameSession));
            } catch (error) {
                console.error('خطأ في حفظ الجلسة:', error);
            }
        }
    }

    /**
     * استعادة جلسة اللعب من localStorage
     */
    loadGameSession() {
        try {
            const savedSession = localStorage.getItem('gameSession');
            if (savedSession) {
                this.gameSession = JSON.parse(savedSession);
                return true;
            }
        } catch (error) {
            console.error('خطأ في تحميل الجلسة:', error);
        }
        return false;
    }

    /**
     * إنهاء جلسة اللعب
     */
    async endGameSession() {
        if (!this.gameSession) return;

        try {
            const token = localStorage.getItem('token');
            const sessionData = {
                ...this.gameSession,
                endTime: Date.now(),
                duration: Date.now() - this.gameSession.startTime,
                netResult: this.gameSession.totalWon - this.gameSession.totalSpent
            };

            // حفظ إحصائيات الجلسة
            await fetch(`${this.BACKEND_URL}/api/games/session-end`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(sessionData)
            });

            // مسح الجلسة من localStorage
            localStorage.removeItem('gameSession');
            this.gameSession = null;
        } catch (error) {
            console.error('خطأ في إنهاء الجلسة:', error);
        }
    }

    /**
     * جلب إحصائيات اللاعب
     */
    async getPlayerStats() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${this.BACKEND_URL}/api/games/player-stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('خطأ في جلب الإحصائيات:', error);
        }
        return null;
    }

    /**
     * توليد معرف جلسة فريد
     */
    generateSessionId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * الحصول على بيانات الجلسة الحالية
     */
    getCurrentSession() {
        return this.gameSession;
    }

    /**
     * الحصول على بيانات اللاعب
     */
    getPlayerData() {
        return this.playerData;
    }
}

// إنشاء مثيل عام للاستخدام
window.gameEconomy = new GameEconomy();

// حفظ البيانات عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
    if (window.gameEconomy && window.gameEconomy.gameSession) {
        window.gameEconomy.saveGameSession();
    }
});

// حفظ البيانات كل 30 ثانية
setInterval(() => {
    if (window.gameEconomy && window.gameEconomy.gameSession) {
        window.gameEconomy.saveGameSession();
    }
}, 30000);
