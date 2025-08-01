import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import { WebSocketService } from '../services/websocket';
import { WebRTCVoiceService, VoiceUser, VoiceActivityData } from '../services/webrtc-voice';
import VoiceSeats from './VoiceSeats';
import VoiceChatBox from './VoiceChatBox';
import { User } from '../types';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Users,
  MessageCircle,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Gamepad2,
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface VoiceRoomProps {
  user: User;
  wsService: WebSocketService;
}

interface VoiceSeat {
  seatNumber: number;
  user: {
    _id: string;
    username: string;
    profileImage?: string;
    playerId: string;
  } | null;
  userPlayerId: string | null;
  isSpeaking: boolean;
  isMuted: boolean;
  joinedAt: string | null;
}

interface VoiceRoomData {
  id: string;
  name: string;
  description: string;
  maxSeats: number;
  seats: VoiceSeat[];
  waitingQueue: Array<{
    user: {
      _id: string;
      username: string;
      profileImage?: string;
      playerId: string;
    };
    userPlayerId: string;
    requestedAt: string;
  }>;
  settings: {
    allowTextChat: boolean;
    autoKickInactive: boolean;
    inactiveTimeoutMinutes: number;
  };
  isActive: boolean;
}

interface VoiceMessage {
  _id: string;
  sender: {
    _id: string;
    username: string;
    profileImage?: string;
    playerId: string;
  };
  content: string;
  timestamp: string;
  messageType: 'text' | 'system' | 'mic_request';
}

const VoiceRoom: React.FC<VoiceRoomProps> = ({ user, wsService }) => {
  const [roomData, setRoomData] = useState<VoiceRoomData | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInSeat, setIsInSeat] = useState(false);
  const [currentSeatNumber, setCurrentSeatNumber] = useState<number | null>(null);
  const [isInWaitingQueue, setIsInWaitingQueue] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showGames, setShowGames] = useState(false);

  // WebRTC Voice Chat states
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [remoteUsers, setRemoteUsers] = useState<VoiceUser[]>([]);
  const [voiceActivity, setVoiceActivity] = useState<Map<string, VoiceActivityData>>(new Map());

  // WebRTC service
  const webrtcServiceRef = useRef<WebRTCVoiceService | null>(null);

  // تحميل بيانات الغرفة الصوتية
  const loadVoiceRoom = async () => {
    try {
      setIsLoading(true);
      const [roomResponse, messagesResponse] = await Promise.all([
        apiService.getVoiceRoom(),
        apiService.getVoiceRoomMessages()
      ]);

      setRoomData(roomResponse as VoiceRoomData);
      setMessages(messagesResponse as VoiceMessage[]);

      // التحقق من حالة المستخدم الحالي
      const userSeat = (roomResponse as VoiceRoomData).seats.find((seat: VoiceSeat) => 
        seat.user && seat.user._id === user.id
      );
      
      if (userSeat) {
        setIsInSeat(true);
        setCurrentSeatNumber(userSeat.seatNumber);
        setIsMuted(userSeat.isMuted);
      } else {
        setIsInSeat(false);
        setCurrentSeatNumber(null);
      }

      // التحقق من قائمة الانتظار
      const inQueue = (roomResponse as VoiceRoomData).waitingQueue.some((item: any) => 
        item.user._id === user.id
      );
      setIsInWaitingQueue(inQueue);

      setError(null);
    } catch (err: any) {
      console.error('Error loading voice room:', err);

      // التحقق من حالة الطرد
      if (err.message && err.message.includes('مطرود من الغرفة الصوتية')) {
        setError(err.message);
        // منع المستخدم من استخدام أي وظائف في الغرفة
        setRoomData({
          id: '',
          name: 'INFINITY ROOM',
          description: 'غرفة صوتية للمحادثة مع الأصدقاء',
          maxSeats: 5,
          seats: [],
          waitingQueue: [],
          settings: {
            allowTextChat: true,
            autoKickInactive: false,
            inactiveTimeoutMinutes: 30
          },
          isActive: false
        });
        return;
      }

      setError(err.message || 'خطأ في تحميل الغرفة الصوتية');
    } finally {
      setIsLoading(false);
    }
  };

  // إعداد WebRTC service
  useEffect(() => {
    // التأكد من وجود user.id قبل إنشاء WebRTC service
    if (!user?.id) {
      console.warn('⚠️ No user ID available, skipping WebRTC service setup');
      return;
    }

    console.log('🔧 Setting up WebRTC Voice Service with user ID:', user.id);

    try {
      webrtcServiceRef.current = new WebRTCVoiceService(wsService);
    } catch (error) {
      console.error('❌ Error creating WebRTC service:', error);
      return;
    }

    // إعداد callbacks للأحداث
    if (webrtcServiceRef.current) {
      webrtcServiceRef.current.onUserJoined = (voiceUser: VoiceUser) => {
        console.log(`👤 User joined voice chat: ${voiceUser.id}`);
        setRemoteUsers(prev => [...prev.filter(u => u.id !== voiceUser.id), voiceUser]);
      };

      webrtcServiceRef.current.onUserLeft = (userId: string) => {
        console.log(`👋 User left voice chat: ${userId}`);
        setRemoteUsers(prev => prev.filter(u => u.id !== userId));
        setVoiceActivity(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
      };

      webrtcServiceRef.current.onVoiceActivity = (data: VoiceActivityData) => {
        console.log('🎤 Voice activity changed:', data.isSpeaking ? 'speaking' : 'silent', `(level: ${data.level})`);

        // تحديث الحالة المحلية
        setVoiceActivity(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, data);
          return newMap;
        });

        // إرسال Voice Activity للمستخدمين الآخرين عبر WebSocket
        if (user?.id && isInSeat) {
          console.log('📤 Voice activity sent:', data.isSpeaking ? 'speaking' : 'silent', `(userId: ${user.id})`);
          wsService.send({
            type: 'voice_activity',
            data: {
              userId: user.id,
              level: data.level,
              isSpeaking: data.isSpeaking,
              timestamp: Date.now()
            }
          });
        } else {
          if (!user?.id) {
            console.warn('⚠️ No currentUserId available for voice activity');
          }
          if (!isInSeat) {
            console.log('🔍 User not in seat, voice activity not sent');
          }
        }
      };

      webrtcServiceRef.current.onError = (error: Error) => {
        console.error('❌ WebRTC error:', error);
        setError(`خطأ في الصوت: ${error.message}`);
      };
    }

    return () => {
      if (webrtcServiceRef.current) {
        console.log('🧹 Cleaning up WebRTC service');
        webrtcServiceRef.current.leaveRoom().catch(console.error);
      }
    };
  }, [wsService, user?.id]); // إضافة optional chaining

  // WebRTC configuration is simpler - no tokens needed



  // إعداد WebSocket listeners
  useEffect(() => {
    const handleVoiceRoomMessage = (data: any) => {
      setMessages(prev => [...prev, data]);
    };

    const handleVoiceRoomUpdate = (data: any) => {
      // تحديث محلي بدلاً من إعادة تحميل كامل لتجنب التحميل المستمر
      if (data.action && data.userId) {
        // تحديث محلي للبيانات بدلاً من إعادة تحميل كامل
        if (data.action === 'seat_joined' || data.action === 'seat_left' || data.action === 'mute_toggled') {
          // سيتم التحديث عبر WebSocket messages الأخرى
        } else {
          loadVoiceRoom(); // إعادة تحميل فقط في حالات محددة
        }
      } else {
        loadVoiceRoom(); // إعادة تحميل في حالة عدم وجود action محدد
      }

              // إذا انضم مستخدم جديد للمقعد، ابدأ اتصال WebRTC
        if (data.action === 'seat_joined' && isInSeat && data.userId !== user.id) {
          setTimeout(() => {
            if (webrtcServiceRef.current) {
              webrtcServiceRef.current.sendOffer(data.userId);
            }
          }, 1000);
        }
    };

    // معالج استقبال Voice Activity من المستخدمين الآخرين
    const handleVoiceActivity = (data: any) => {
      if (data.userId && data.userId !== user.id) {
        // تحديث Voice Activity للمستخدمين الآخرين
        setVoiceActivity(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId.toString(), {
            userId: data.userId.toString(),
            level: data.level,
            isSpeaking: data.isSpeaking
          });
          return newMap;
        });

        // تحديث حالة التحدث في بيانات الغرفة
        setRoomData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            seats: prev.seats.map(seat =>
              seat.user?._id === data.userId
                ? { ...seat, isSpeaking: data.isSpeaking }
                : seat
            )
          };
        });
      }
    };



    // معالج الأحداث الإدارية
    const handleAdminActionUpdate = (data: any) => {
      // إعادة تحميل بيانات الغرفة بعد الإجراء الإداري
      loadVoiceRoom();
    };

    wsService.onMessage('voice_room_message', handleVoiceRoomMessage);
    wsService.onMessage('voice_room_update', handleVoiceRoomUpdate);
    wsService.onMessage('voice_activity', handleVoiceActivity);
    wsService.onMessage('admin_action_update', handleAdminActionUpdate);

    return () => {
      wsService.offMessage('voice_room_message', handleVoiceRoomMessage);
      wsService.offMessage('voice_room_update', handleVoiceRoomUpdate);
      wsService.offMessage('voice_activity', handleVoiceActivity);
      wsService.offMessage('admin_action_update', handleAdminActionUpdate);
    };
  }, [wsService, isInSeat, user.id]);

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    loadVoiceRoom();
  }, []);

  // إضافة تحذير عند مغادرة الصفحة إذا كان المستخدم في مقعد
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isInSeat) {
        e.preventDefault();
        e.returnValue = 'أنت حالياً في الغرفة الصوتية. هل تريد المغادرة؟';
        return 'أنت حالياً في الغرفة الصوتية. هل تريد المغادرة؟';
      }
    };

    const handleUnload = () => {
      // إذا غادر المستخدم الصفحة وهو في مقعد، أرسل إشارة مغادرة
      if (isInSeat) {
        navigator.sendBeacon('/api/voice-room/leave-seat', JSON.stringify({
          userId: user.id
        }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, [isInSeat, user.id]);

  // إرسال رسالة نصية
  const sendMessage = async (content: string) => {
    try {
      const response = await apiService.sendVoiceRoomMessage(content);
      
      // إرسال عبر WebSocket للتحديث الفوري
      wsService.send({
        type: 'voice_room_message',
        data: (response as any).messageData
      });
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'خطأ في إرسال الرسالة');
    }
  };

  // طلب المايك
  const requestMic = async () => {
    try {
      setIsConnecting(true);
      await apiService.requestMic();
      
      // إرسال تحديث عبر WebSocket
      wsService.send({
        type: 'voice_room_update',
        data: { action: 'mic_requested', userId: user.id }
      });
      
      await loadVoiceRoom();
    } catch (err: any) {
      console.error('Error requesting mic:', err);
      setError(err.message || 'خطأ في طلب المايك');
    } finally {
      setIsConnecting(false);
    }
  };

  // إلغاء طلب المايك
  const cancelMicRequest = async () => {
    try {
      await apiService.cancelMicRequest();
      
      wsService.send({
        type: 'voice_room_update',
        data: { action: 'mic_request_cancelled', userId: user.id }
      });
      
      await loadVoiceRoom();
    } catch (err: any) {
      console.error('Error cancelling mic request:', err);
      setError(err.message || 'خطأ في إلغاء طلب المايك');
    }
  };

  // الانضمام لمقعد
  const joinSeat = async (seatNumber: number) => {
    try {
      setIsConnecting(true);
      setError(null);

      // الانضمام للمقعد في قاعدة البيانات
      await apiService.joinVoiceSeat(seatNumber);

      // تحديث فوري للحالة
      setIsInSeat(true);
      setCurrentSeatNumber(seatNumber);
      setIsMuted(false);

      // بدء المحادثة الصوتية مع WebRTC
      if (webrtcServiceRef.current && user?.id) {
        try {
          // الانضمام لغرفة الصوت
          const roomId = `voice-room-${roomData?.id || 'default'}`;
          await webrtcServiceRef.current.joinRoom(roomId, user.id);

          setIsVoiceConnected(true);

        } catch (webrtcError) {
          console.error('❌ WebRTC initialization failed:', webrtcError);
          const errorMessage = webrtcError instanceof Error ? webrtcError.message : 'خطأ غير معروف';
          setError(`فشل في بدء المحادثة الصوتية: ${errorMessage}`);
        }
      }

      // حفظ حالة الانضمام للغرفة الصوتية
      localStorage.setItem('isInVoiceRoom', 'true');
      localStorage.setItem('voiceRoomSeat', seatNumber.toString());

      // إشعار المستخدمين الآخرين
      wsService.send({
        type: 'voice_room_update',
        data: { action: 'seat_joined', userId: user.id, seatNumber }
      });

      await loadVoiceRoom();
    } catch (err: any) {
      console.error('Error joining seat:', err);
      setError(err.message || 'خطأ في الانضمام للمقعد');
      setIsVoiceConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // مغادرة المقعد
  const leaveSeat = async () => {
    try {
      setIsConnecting(true);
      await apiService.leaveSeat();

      // تحديث فوري للحالة
      setIsInSeat(false);
      setCurrentSeatNumber(null);
      setIsMuted(false);

      // إيقاف WebRTC
      if (webrtcServiceRef.current) {
        webrtcServiceRef.current.leaveRoom();
      }

      wsService.send({
        type: 'voice_room_update',
        data: { action: 'seat_left', userId: user.id, seatNumber: currentSeatNumber }
      });

    } catch (err: any) {
      console.error('Error leaving seat:', err);
      // تجاهل خطأ "لست في أي مقعد" لأنه غير مهم
      if (!err.message?.includes('لست في أي مقعد')) {
        setError(err.message || 'خطأ في مغادرة المقعد');
      }
    } finally {
      setIsConnecting(false);
    }
  };



  // تبديل كتم المايك
  const toggleMute = async () => {
    try {
      if (!isInSeat) {
        setError('يجب أن تكون في مقعد لاستخدام المايك');
        return;
      }

      if (!webrtcServiceRef.current) {
        setError('خدمة الصوت غير متاحة - جاري إعادة الاتصال...');
        return;
      }

      const newMutedState = !isMuted;

      // تطبيق الكتم في WebRTC أولاً
      webrtcServiceRef.current.setMute(newMutedState);

      // تحديث الحالة المحلية
      setIsMuted(newMutedState);

      // تحديث الخادم
      try {
        await apiService.toggleMute(newMutedState);
      } catch (serverError) {
        console.warn('Failed to update server mute state:', serverError);
      }

      // إشعار المستخدمين الآخرين
      wsService.send({
        type: 'voice_room_update',
        data: { action: 'mute_toggled', userId: user.id, isMuted: newMutedState }
      });

    } catch (err: any) {
      console.error('Error toggling mute:', err);
      setError('خطأ في تبديل كتم المايك');
      // إعادة تعيين الحالة في حالة الخطأ
      setIsMuted(!isMuted);
    }
  };

  // الدوال الإدارية
  const handleAdminAction = async (action: string, targetUserId: string, duration?: number) => {
    try {
      let result;
      switch (action) {
        case 'kick':
          result = await apiService.kickUserFromVoiceRoom(targetUserId, duration);
          break;
        case 'mute':
          result = await apiService.muteUserInVoiceRoom(targetUserId);
          break;
        case 'unmute':
          result = await apiService.unmuteUserInVoiceRoom(targetUserId);
          break;
        case 'removeSeat':
          result = await apiService.removeUserFromSeat(targetUserId);
          break;
        case 'removeQueue':
          result = await apiService.removeUserFromQueue(targetUserId);
          break;
        case 'banChat':
          result = await apiService.banUserFromChat(targetUserId);
          break;
        case 'unbanChat':
          result = await apiService.unbanUserFromChat(targetUserId);
          break;
      }

      if (result) {
        // إرسال تحديث إداري
        wsService.send({
          type: 'admin_action_update',
          data: { action, targetUserId, adminId: user.id, result }
        });
      }
    } catch (err: any) {
      console.error('Error performing admin action:', err);
      setError(err.message || 'خطأ في تنفيذ الإجراء الإداري');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-300" />
          <p className="text-purple-200">جاري تحميل الغرفة الصوتية...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadVoiceRoom}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
        <div className="text-center text-purple-200">
          <p>لا توجد بيانات للغرفة الصوتية</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 overflow-hidden">
      {/* شعار انفنتي في المنتصف مع تأثيرات */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center opacity-5">
          <div className="text-9xl font-bold text-white mb-4 animate-pulse">∞</div>
          <div className="text-3xl font-bold text-purple-200 tracking-wider">INFINITY</div>
        </div>
      </div>

      {/* تأثيرات الخلفية */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="relative z-10 h-full flex flex-col">
        {/* الهيدر */}
        <div className="bg-gradient-to-r from-purple-800/60 to-indigo-800/60 backdrop-blur-md border-b border-purple-500/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">الغرفة الصوتية</h1>
                <p className="text-purple-200 text-sm">تواصل مع الأصدقاء</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* حالة الاتصال */}
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full border border-purple-500/20">
                <div className={`w-2 h-2 rounded-full ${isConnecting ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`}></div>
                <span className="text-white text-sm font-medium">
                  {isConnecting ? 'جاري الاتصال...' : 'متصل'}
                </span>
              </div>

              {/* عدد المستخدمين */}
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-3 py-2 rounded-full border border-purple-500/20">
                <Users className="w-4 h-4 text-purple-300" />
                <span className="text-white text-sm font-medium">
                  {roomData?.seats.filter(seat => seat.user).length || 0}/{roomData?.maxSeats || 8}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* منطقة المقاعد */}
        <div className="flex-1 p-6">
          <VoiceSeats
            seats={roomData?.seats || []}
            waitingQueue={roomData?.waitingQueue || []}
            currentUser={user}
            isInSeat={isInSeat}
            currentSeatNumber={currentSeatNumber}
            isInWaitingQueue={isInWaitingQueue}
            isConnecting={isConnecting}
            onJoinSeat={joinSeat}
            onRequestMic={requestMic}
            onCancelMicRequest={cancelMicRequest}
          />
        </div>

        {/* نافذة المحادثة النصية */}
        {showChat && (
          <div className="absolute top-20 left-4 right-4 z-40 animate-slide-down">
            <VoiceChatBox
              messages={messages}
              currentUser={user}
              isInWaitingQueue={isInWaitingQueue}
              onSendMessage={sendMessage}
              onRequestMic={requestMic}
            />
          </div>
        )}

        {/* قائمة الألعاب المختصرة */}
        {showGames && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30 animate-slide-up">
            <div className="bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30 shadow-2xl">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.open('/game8.html', '_blank')}
                  className="group relative p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 hover:from-green-500/40 hover:to-emerald-500/40 rounded-xl border border-green-500/30 hover:border-green-400/50 transition-all duration-300 transform hover:scale-105"
                  title="صناديق الحظ"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white font-bold text-sm">🎯</span>
                  </div>
                </button>
                <button 
                  onClick={() => window.open('/speed-challenge.html', '_blank')}
                  className="group relative p-3 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/40 hover:to-orange-500/40 rounded-xl border border-yellow-500/30 hover:border-yellow-400/50 transition-all duration-300 transform hover:scale-105"
                  title="تحدي السرعة"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white font-bold text-sm">⚡</span>
                  </div>
                </button>
                <button 
                  onClick={() => window.open('/mind-puzzles.html', '_blank')}
                  className="group relative p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 hover:from-blue-500/40 hover:to-cyan-500/40 rounded-xl border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300 transform hover:scale-105"
                  title="ألغاز العقل"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white font-bold text-sm">🧩</span>
                  </div>
                </button>
                <button 
                  onClick={() => window.open('/memory-match.html', '_blank')}
                  className="group relative p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/40 hover:to-pink-500/40 rounded-xl border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 transform hover:scale-105"
                  title="لعبة الذاكرة"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white font-bold text-sm">🧠</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* أزرار التحكم في الأسفل - تصميم دائري حديث */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
          <div className="flex items-center gap-4">
            {/* زر كتم/إلغاء كتم المايك */}
            {isInSeat && (
              <button
                onClick={toggleMute}
                className={`group relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl transform hover:scale-110 hover:rotate-12 ${
                  isMuted
                    ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/50 hover:shadow-red-500/70'
                    : 'bg-gradient-to-br from-green-500 to-emerald-500 shadow-green-500/50 hover:shadow-green-500/70'
                }`}
                title={isMuted ? 'إلغاء كتم المايك' : 'كتم المايك'}
              >
                {/* تأثير التوهج */}
                <div className={`absolute inset-0 rounded-full blur-lg opacity-50 group-hover:opacity-70 transition-opacity ${
                  isMuted ? 'bg-red-500' : 'bg-green-500'
                }`}></div>
                
                {isMuted ? (
                  <MicOff className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform" />
                ) : (
                  <Mic className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform" />
                )}
                
                {/* تأثير النبض */}
                <div className={`absolute inset-0 rounded-full border-2 border-white/30 animate-ping ${
                  isMuted ? 'border-red-400' : 'border-green-400'
                }`}></div>
              </button>
            )}

            {/* زر المغادرة */}
            {isInSeat && (
              <button
                onClick={leaveSeat}
                className="group relative w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl shadow-red-500/50 hover:shadow-red-500/70 transform hover:scale-110 hover:rotate-12"
                title="مغادرة المقعد"
                disabled={isConnecting}
              >
                {/* تأثير التوهج */}
                <div className="absolute inset-0 rounded-full blur-lg bg-red-500 opacity-50 group-hover:opacity-70 transition-opacity"></div>
                
                <X className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform" />
                
                {/* تأثير النبض */}
                <div className="absolute inset-0 rounded-full border-2 border-red-400/30 animate-ping"></div>
              </button>
            )}

            {/* زر المحادثة النصية */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`group relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl transform hover:scale-110 hover:rotate-12 ${
                showChat
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 shadow-purple-500/50 hover:shadow-purple-500/70'
                  : 'bg-gradient-to-br from-purple-500 to-purple-600 shadow-purple-500/50 hover:shadow-purple-500/70'
              }`}
              title="المحادثة النصية"
            >
              {/* تأثير التوهج */}
              <div className="absolute inset-0 rounded-full blur-lg bg-purple-500 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              
              <MessageCircle className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform" />
              
              {/* تأثير النبض */}
              <div className="absolute inset-0 rounded-full border-2 border-purple-400/30 animate-ping"></div>
            </button>

            {/* زر الألعاب المختصر */}
            <button
              onClick={() => setShowGames(!showGames)}
              className={`group relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl transform hover:scale-110 hover:rotate-12 ${
                showGames
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-indigo-500/50 hover:shadow-indigo-500/70'
                  : 'bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-indigo-500/50 hover:shadow-indigo-500/70'
              }`}
              title="الألعاب"
            >
              {/* تأثير التوهج */}
              <div className="absolute inset-0 rounded-full blur-lg bg-indigo-500 opacity-50 group-hover:opacity-70 transition-opacity"></div>
              
              <Gamepad2 className="w-7 h-7 text-white relative z-10 group-hover:scale-110 transition-transform" />
              
              {/* تأثير النبض */}
              <div className="absolute inset-0 rounded-full border-2 border-indigo-400/30 animate-ping"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceRoom;
