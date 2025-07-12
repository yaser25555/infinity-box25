// خدمة التزامن في الوقت الحقيقي
import { WebSocketService } from './websocket';
import { apiService } from './api';

export interface SyncState {
  isOnline: boolean;
  lastSync: Date | null;
  pendingActions: PendingAction[];
  conflictResolution: 'server' | 'client' | 'merge';
}

export interface PendingAction {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export class RealTimeSyncService {
  private wsService: WebSocketService;
  private syncState: SyncState;
  private syncInterval: NodeJS.Timeout | null = null;
  private conflictHandlers: Map<string, (serverData: any, clientData: any) => any> = new Map();

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
    this.syncState = {
      isOnline: navigator.onLine,
      lastSync: null,
      pendingActions: [],
      conflictResolution: 'server'
    };

    this.initializeEventListeners();
    this.startSyncLoop();
  }

  // تهيئة مستمعي الأحداث
  private initializeEventListeners() {
    // مراقبة حالة الاتصال
    window.addEventListener('online', () => {
      this.syncState.isOnline = true;
      this.processPendingActions();
    });

    window.addEventListener('offline', () => {
      this.syncState.isOnline = false;
    });

    // مستمعي WebSocket
    this.wsService.onMessage('balance_update', (data) => {
      this.handleBalanceUpdate(data);
    });

    this.wsService.onMessage('profile_updated', (data) => {
      this.handleProfileUpdate(data);
    });

    this.wsService.onMessage('gift_received', (data) => {
      this.handleGiftReceived(data);
    });

    this.wsService.onMessage('sync_conflict', (data) => {
      this.handleSyncConflict(data);
    });
  }

  // بدء حلقة التزامن
  private startSyncLoop() {
    this.syncInterval = setInterval(() => {
      if (this.syncState.isOnline) {
        this.syncWithServer();
      }
    }, 30000); // كل 30 ثانية
  }

  // إيقاف حلقة التزامن
  public stopSyncLoop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // إضافة إجراء معلق
  public addPendingAction(type: string, data: any, maxRetries: number = 3): string {
    const action: PendingAction = {
      id: this.generateActionId(),
      type,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries
    };

    this.syncState.pendingActions.push(action);
    
    // محاولة تنفيذ فوري إذا كان متصل
    if (this.syncState.isOnline) {
      this.executeAction(action);
    }

    return action.id;
  }

  // تنفيذ إجراء
  private async executeAction(action: PendingAction): Promise<boolean> {
    try {
      let result;
      
      switch (action.type) {
        case 'update_balance':
          result = await apiService.updateBalance(
            action.data.balanceChange,
            action.data.gameType,
            action.data.sessionId,
            action.data.gameResult
          );
          break;
          
        case 'send_gift':
          result = await apiService.sendGift(
            action.data.toUserId,
            action.data.giftType,
            action.data.amount,
            action.data.message
          );
          break;
          
        case 'update_profile':
          result = await apiService.updateProfile(action.data);
          break;
          
        default:
          console.warn('نوع إجراء غير معروف:', action.type);
          return false;
      }

      if (result.success) {
        this.removeAction(action.id);
        return true;
      } else {
        throw new Error(result.message || 'فشل في تنفيذ الإجراء');
      }
    } catch (error) {
      console.error('خطأ في تنفيذ الإجراء:', error);
      action.retryCount++;
      
      if (action.retryCount >= action.maxRetries) {
        this.removeAction(action.id);
        this.handleActionFailure(action, error);
      }
      
      return false;
    }
  }

  // معالجة الإجراءات المعلقة
  private async processPendingActions() {
    const actionsToProcess = [...this.syncState.pendingActions];
    
    for (const action of actionsToProcess) {
      await this.executeAction(action);
      // تأخير قصير بين الإجراءات لتجنب الإرهاق
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // التزامن مع الخادم
  private async syncWithServer() {
    try {
      const syncData = await apiService.getSyncData(this.syncState.lastSync);
      
      if (syncData.hasUpdates) {
        this.applySyncUpdates(syncData.updates);
      }
      
      this.syncState.lastSync = new Date();
    } catch (error) {
      console.error('خطأ في التزامن مع الخادم:', error);
    }
  }

  // تطبيق تحديثات التزامن
  private applySyncUpdates(updates: any[]) {
    updates.forEach(update => {
      switch (update.type) {
        case 'balance':
          this.updateLocalBalance(update.data);
          break;
        case 'profile':
          this.updateLocalProfile(update.data);
          break;
        case 'gifts':
          this.updateLocalGifts(update.data);
          break;
      }
    });
  }

  // معالجة تحديث الرصيد
  private handleBalanceUpdate(data: any) {
    // تحديث الرصيد المحلي
    this.updateLocalBalance(data);
    
    // إشعار المكونات المهتمة
    window.dispatchEvent(new CustomEvent('balanceUpdated', { detail: data }));
  }

  // معالجة تحديث البروفايل
  private handleProfileUpdate(data: any) {
    this.updateLocalProfile(data.user);
    window.dispatchEvent(new CustomEvent('profileUpdated', { detail: data.user }));
  }

  // معالجة استلام هدية
  private handleGiftReceived(data: any) {
    this.updateLocalBalance({ newBalance: data.newBalance });
    window.dispatchEvent(new CustomEvent('giftReceived', { detail: data.gift }));
  }

  // معالجة تضارب التزامن
  private handleSyncConflict(data: any) {
    const handler = this.conflictHandlers.get(data.type);
    
    if (handler) {
      const resolvedData = handler(data.serverData, data.clientData);
      this.applySyncUpdates([{ type: data.type, data: resolvedData }]);
    } else {
      // الافتراضي: أولوية للخادم
      this.applySyncUpdates([{ type: data.type, data: data.serverData }]);
    }
  }

  // تحديث الرصيد المحلي
  private updateLocalBalance(data: any) {
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
    if (currentUser.id) {
      currentUser.goldCoins = data.newBalance || data.goldCoins;
      if (data.pearls !== undefined) {
        currentUser.pearls = data.pearls;
      }
      localStorage.setItem('userData', JSON.stringify(currentUser));
    }
  }

  // تحديث البروفايل المحلي
  private updateLocalProfile(profileData: any) {
    const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
    Object.assign(currentUser, profileData);
    localStorage.setItem('userData', JSON.stringify(currentUser));
  }

  // تحديث الهدايا المحلية
  private updateLocalGifts(giftsData: any) {
    // تحديث قائمة الهدايا في localStorage أو state management
    const gifts = JSON.parse(localStorage.getItem('gifts') || '[]');
    gifts.unshift(giftsData);
    localStorage.setItem('gifts', JSON.stringify(gifts.slice(0, 100))); // الاحتفاظ بآخر 100 هدية
  }

  // إزالة إجراء
  private removeAction(actionId: string) {
    this.syncState.pendingActions = this.syncState.pendingActions.filter(
      action => action.id !== actionId
    );
  }

  // معالجة فشل الإجراء
  private handleActionFailure(action: PendingAction, error: any) {
    console.error('فشل في تنفيذ الإجراء نهائياً:', action, error);
    
    // إشعار المستخدم
    window.dispatchEvent(new CustomEvent('actionFailed', { 
      detail: { action, error } 
    }));
  }

  // توليد معرف إجراء
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // تسجيل معالج تضارب
  public registerConflictHandler(type: string, handler: (serverData: any, clientData: any) => any) {
    this.conflictHandlers.set(type, handler);
  }

  // الحصول على حالة التزامن
  public getSyncState(): SyncState {
    return { ...this.syncState };
  }

  // فرض التزامن الفوري
  public async forcSync(): Promise<void> {
    if (this.syncState.isOnline) {
      await this.syncWithServer();
      await this.processPendingActions();
    }
  }
}
