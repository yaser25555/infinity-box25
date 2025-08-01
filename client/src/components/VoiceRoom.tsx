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
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* المحتوى الرئيسي */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800/60 to-indigo-800/60 backdrop-blur-md border-b border-purple-500/30 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/50">
                <Volume2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide">INFINITY ROOM</h1>
                <p className="text-purple-200 text-sm">غرفة صوتية للمحادثة مع الأصدقاء</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-purple-500/20">
                <Users className="w-4 h-4 text-purple-300" />
                <span className="text-purple-200 text-sm font-medium">
                  {roomData.seats.filter(seat => seat.user).length}/{roomData.maxSeats}
                </span>
              </div>

              <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-full border border-purple-500/20">
                {isVoiceConnected ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <span className="text-purple-200 text-sm font-medium">
                  {isVoiceConnected ? 'متصل' : 'غير متصل'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* المقاعد الصوتية */}
        <div className="flex-1 p-6 overflow-y-auto">
          <VoiceSeats
            seats={roomData.seats}
            waitingQueue={roomData.waitingQueue}
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

        {/* نافذة المحادثة النصية - تنزل من الأعلى */}
        {showChat && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-purple-900/95 to-indigo-900/95 backdrop-blur-md border-b border-purple-500/40 shadow-2xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-purple-300" />
                  المحادثة النصية
                </h3>
                <button
                  onClick={() => setShowChat(false)}
                  className="w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg shadow-purple-600/50"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <VoiceChatBox
                messages={messages}
                currentUser={user}
                isInWaitingQueue={isInWaitingQueue}
                onSendMessage={sendMessage}
                onRequestMic={requestMic}
              />
            </div>
          </div>
        )}

        {/* شريط الألعاب - في الأسفل */}
        {showGames && (
          <div className="absolute bottom-20 left-0 right-0 z-20 bg-gradient-to-t from-purple-900/95 to-indigo-900/95 backdrop-blur-md border-t border-purple-500/40 shadow-2xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-purple-300" />
                  الألعاب
                </h3>
                <button
                  onClick={() => setShowGames(false)}
                  className="w-8 h-8 bg-purple-600 hover:bg-purple-700 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg shadow-purple-600/50"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button className="p-4 bg-purple-600/50 hover:bg-purple-600/70 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-600/25">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-inner">
                      <span className="text-white font-bold text-xl">🎮</span>
                    </div>
                    <span className="text-white text-sm font-medium">لعبة 1</span>
                  </div>
                </button>
                <button className="p-4 bg-purple-600/50 hover:bg-purple-600/70 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-600/25">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-inner">
                      <span className="text-white font-bold text-xl">🎯</span>
                    </div>
                    <span className="text-white text-sm font-medium">لعبة 2</span>
                  </div>
                </button>
                <button className="p-4 bg-purple-600/50 hover:bg-purple-600/70 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-600/25">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-inner">
                      <span className="text-white font-bold text-xl">🧩</span>
                    </div>
                    <span className="text-white text-sm font-medium">لعبة 3</span>
                  </div>
                </button>
                <button className="p-4 bg-purple-600/50 hover:bg-purple-600/70 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-purple-600/25">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-500 rounded-lg mx-auto mb-2 flex items-center justify-center shadow-inner">
                      <span className="text-white font-bold text-xl">🎲</span>
                    </div>
                    <span className="text-white text-sm font-medium">لعبة 4</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* أزرار التحكم في الأسفل - مدورة وصغيرة */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
          <div className="flex items-center gap-4">
            {/* زر كتم/إلغاء كتم المايك */}
            {isInSeat && (
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl transform hover:scale-110 ${
                  isMuted
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/50'
                    : 'bg-green-500 hover:bg-green-600 shadow-green-500/50'
                }`}
                title={isMuted ? 'إلغاء كتم المايك' : 'كتم المايك'}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
            )}

            {/* زر المغادرة */}
            {isInSeat && (
              <button
                onClick={leaveSeat}
                className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl shadow-red-500/50 transform hover:scale-110"
                title="مغادرة المقعد"
                disabled={isConnecting}
              >
                <X className="w-6 h-6 text-white" />
              </button>
            )}

            {/* زر المحادثة النصية */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl transform hover:scale-110 ${
                showChat
                  ? 'bg-purple-600 shadow-purple-500/50'
                  : 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/50'
              }`}
              title="المحادثة النصية"
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </button>

            {/* زر الألعاب */}
            <button
              onClick={() => setShowGames(!showGames)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl transform hover:scale-110 ${
                showGames
                  ? 'bg-indigo-600 shadow-indigo-500/50'
                  : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/50'
              }`}
              title="الألعاب"
            >
              <Gamepad2 className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceRoom;
