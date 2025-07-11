// WebRTC Voice Chat Service - Simple and Reliable
export interface VoiceUser {
  id: string;
  isSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;
}

export interface VoiceActivityData {
  userId: string;
  level: number;
  isSpeaking: boolean;
}

export class WebRTCVoiceService {
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteUsers: Map<string, VoiceUser> = new Map();
  private pendingIceCandidates: Map<string, RTCIceCandidate[]> = new Map();
  private isJoined = false;
  private isMuted = false;
  private roomId: string | null = null;
  private userId: string | null = null;
  
  // Voice Activity Detection
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private voiceActivityThreshold = 25;
  private isMonitoringVoice = false;
  private isSpeaking = false;
  private lastVoiceActivitySent = 0;
  private voiceActivityDebounce = 500; // 500ms debounce
  
  // Callbacks
  public onUserJoined?: (user: VoiceUser) => void;
  public onUserLeft?: (userId: string) => void;
  public onVoiceActivity?: (data: VoiceActivityData) => void;
  public onError?: (error: Error) => void;
  
  // WebSocket for signaling
  private wsService: any;
  
  // ICE Servers (STUN/TURN)
  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  constructor(wsService: any) {
    this.wsService = wsService;
    this.setupWebSocketHandlers();
  }

  // Setup WebSocket handlers for signaling
  private setupWebSocketHandlers() {
    this.wsService.onMessage('webrtc_offer', this.handleOffer.bind(this));
    this.wsService.onMessage('webrtc_answer', this.handleAnswer.bind(this));
    this.wsService.onMessage('webrtc_ice_candidate', this.handleIceCandidate.bind(this));
    this.wsService.onMessage('user_joined_voice', this.handleUserJoined.bind(this));
    this.wsService.onMessage('user_left_voice', this.handleUserLeft.bind(this));
  }

  // Join voice room
  async joinRoom(roomId: string, userId: string): Promise<void> {
    try {
      console.log('🎤 Joining voice room:', roomId, 'as user:', userId);
      
      this.roomId = roomId;
      this.userId = userId;
      
      // Get user media with enhanced echo cancellation
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });
      
      console.log('✅ Got local audio stream');
      
      // Start voice activity detection
      this.startVoiceActivityDetection();
      
      // Notify server about joining
      console.log('📤 Sending join_voice_room message to server');
      this.wsService.send({
        type: 'join_voice_room',
        data: { roomId, userId }
      });
      console.log('✅ join_voice_room message sent');
      
      this.isJoined = true;
      console.log('✅ Joined voice room successfully');
      
    } catch (error) {
      console.error('❌ Error joining voice room:', error);
      this.onError?.(error as Error);
      throw error;
    }
  }

  // Leave voice room
  async leaveRoom(): Promise<void> {
    try {
      console.log('🔄 Leaving voice room...');
      
      // Close all peer connections
      this.peerConnections.forEach((pc, userId) => {
        pc.close();
      });
      this.peerConnections.clear();
      this.pendingIceCandidates.clear();
      
      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      
      // Stop voice monitoring
      this.stopVoiceActivityDetection();
      
      // Notify server
      if (this.roomId && this.userId) {
        this.wsService.send({
          type: 'leave_voice_room',
          data: { roomId: this.roomId, userId: this.userId }
        });
      }
      
      this.isJoined = false;
      this.remoteUsers.clear();
      
      console.log('✅ Left voice room successfully');
      
    } catch (error) {
      console.error('❌ Error leaving voice room:', error);
      this.onError?.(error as Error);
    }
  }

  // Toggle mute
  async toggleMute(): Promise<boolean> {
    try {
      // إذا لم يكن هناك stream، حاول إنشاؤه أولاً
      if (!this.localStream) {
        console.warn('⚠️ No local stream available, attempting to create one...');

        // إذا كنا في غرفة، حاول إعادة إنشاء الـ stream
        if (this.isJoined && this.roomId && this.userId) {
          try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 1
              },
              video: false
            });
            console.log('✅ Successfully recreated local stream');
          } catch (streamError) {
            console.error('❌ Failed to recreate local stream:', streamError);
            // تبديل الحالة المحلية فقط
            this.isMuted = !this.isMuted;
            console.log(this.isMuted ? '🔇 Muted (local only)' : '🔊 Unmuted (local only)');
            return this.isMuted;
          }
        } else {
          // تبديل الحالة المحلية فقط
          this.isMuted = !this.isMuted;
          console.log(this.isMuted ? '🔇 Muted (local only)' : '🔊 Unmuted (local only)');
          return this.isMuted;
        }
      }

      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isMuted = !audioTrack.enabled;

        console.log(this.isMuted ? '🔇 Muted' : '🔊 Unmuted');
        return this.isMuted;
      }

      // إذا لم نجد audio track، تبديل الحالة المحلية
      this.isMuted = !this.isMuted;
      console.log(this.isMuted ? '🔇 Muted (no audio track)' : '🔊 Unmuted (no audio track)');
      return this.isMuted;

    } catch (error) {
      console.error('Error toggling mute:', error);
      // في حالة الخطأ، تبديل الحالة المحلية على الأقل
      this.isMuted = !this.isMuted;
      console.log(this.isMuted ? '🔇 Muted (fallback)' : '🔊 Unmuted (fallback)');
      return this.isMuted;
    }
  }

  // Set mute state directly
  setMute(muted: boolean): void {
    try {
      this.isMuted = muted;

      if (!this.localStream) {
        console.warn('⚠️ No local stream available for mute control, state updated locally');
        return;
      }

      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !muted;
        console.log(muted ? '🔇 Muted' : '🔊 Unmuted');
      } else {
        console.warn('⚠️ No audio track found, state updated locally');
      }
    } catch (error) {
      console.error('Error setting mute state:', error);
      // تحديث الحالة المحلية على الأقل
      this.isMuted = muted;
    }
  }

  // Get current mute state
  getMuteState(): boolean {
    return this.isMuted;
  }

  // Check if local stream is available
  hasLocalStream(): boolean {
    return !!(this.localStream && this.localStream.getAudioTracks().length > 0);
  }

  // Get stream status for debugging
  getStreamStatus(): { hasStream: boolean; hasAudioTrack: boolean; isJoined: boolean } {
    return {
      hasStream: !!this.localStream,
      hasAudioTrack: !!(this.localStream && this.localStream.getAudioTracks().length > 0),
      isJoined: this.isJoined
    };
  }

  // Recreate local stream if needed
  async recreateLocalStream(): Promise<boolean> {
    try {
      if (this.localStream) {
        // إيقاف الـ stream الحالي
        this.localStream.getTracks().forEach(track => track.stop());
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });

      console.log('✅ Successfully recreated local stream');

      // إعادة إضافة الـ stream للاتصالات الموجودة
      this.peerConnections.forEach((pc, userId) => {
        if (this.localStream) {
          // إزالة المسارات القديمة
          pc.getSenders().forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
              pc.removeTrack(sender);
            }
          });

          // إضافة المسارات الجديدة
          this.localStream.getAudioTracks().forEach(track => {
            pc.addTrack(track, this.localStream!);
          });
        }
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to recreate local stream:', error);
      return false;
    }
  }

  // Create peer connection for a user
  private async createPeerConnection(userId: string): Promise<RTCPeerConnection> {
    const pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10
    });

    // Add local stream with consistent ordering
    if (this.localStream) {
      // Add audio tracks first to ensure consistent m-line ordering
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        pc.addTrack(track, this.localStream!);
        console.log('➕ Added audio track to peer connection for:', userId);
      });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('🔊 Received remote stream from:', userId);
      const [remoteStream] = event.streams;
      
      // Play remote audio with echo prevention
      const audio = new Audio();
      audio.srcObject = remoteStream;
      audio.volume = 0.8; // Reduce volume to prevent feedback
      audio.autoplay = true;

      // Prevent echo by ensuring audio doesn't loop back
      if (audio.setSinkId) {
        // Use default audio output device
        audio.setSinkId('default').catch(console.error);
      }

      audio.play().catch(console.error);
      
      // Update user
      const user = this.remoteUsers.get(userId) || {
        id: userId,
        isSpeaking: false,
        isMuted: false,
        audioLevel: 0
      };
      this.remoteUsers.set(userId, user);
      this.onUserJoined?.(user);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.wsService.send({
          type: 'webrtc_ice_candidate',
          data: {
            candidate: event.candidate,
            targetUserId: userId,
            fromUserId: this.userId
          }
        });
      }
    };
    
    this.peerConnections.set(userId, pc);
    return pc;
  }

  // Handle WebRTC offer
  private async handleOffer(data: any) {
    try {
      const { offer, fromUserId } = data;
      console.log('📥 Received offer from:', fromUserId);
      console.log('🔄 Creating peer connection and answer for:', fromUserId);

      // Check if we already have a connection with this user
      let pc = this.peerConnections.get(fromUserId);
      if (pc && pc.signalingState !== 'stable') {
        console.log('🔄 Closing existing unstable connection with:', fromUserId);
        pc.close();
        this.peerConnections.delete(fromUserId);
        pc = null;
      }

      if (!pc) {
        pc = await this.createPeerConnection(fromUserId);
      }

      await pc.setRemoteDescription(offer);
      console.log('✅ Set remote description (offer)');

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('✅ Created and set local description (answer)');

      // Process any pending ICE candidates
      await this.processPendingIceCandidates(fromUserId);

      console.log('📤 Sending WebRTC answer to:', fromUserId);
      this.wsService.send({
        type: 'webrtc_answer',
        data: {
          answer,
          targetUserId: fromUserId,
          fromUserId: this.userId
        }
      });

    } catch (error) {
      console.error('❌ Error handling offer:', error);
    }
  }

  // Handle WebRTC answer
  private async handleAnswer(data: any) {
    try {
      const { answer, fromUserId } = data;
      console.log('📥 Received answer from:', fromUserId);

      const pc = this.peerConnections.get(fromUserId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(answer);
        console.log('✅ Set remote description (answer) for:', fromUserId);
        console.log('🔗 WebRTC connection should be established with:', fromUserId);

        // Process any pending ICE candidates
        await this.processPendingIceCandidates(fromUserId);
      } else if (pc) {
        console.warn('⚠️ Peer connection not in correct state for answer:', pc.signalingState);
      } else {
        console.warn('⚠️ No peer connection found for:', fromUserId);
      }

    } catch (error) {
      console.error('❌ Error handling answer:', error);
    }
  }

  // Handle ICE candidate
  private async handleIceCandidate(data: any) {
    try {
      const { candidate, fromUserId } = data;

      const pc = this.peerConnections.get(fromUserId);
      if (pc && pc.remoteDescription) {
        // Only add ICE candidates after remote description is set
        await pc.addIceCandidate(candidate);
        console.log('🧊 ICE candidate added for:', fromUserId);
      } else if (pc) {
        // Queue ICE candidates if remote description is not set yet
        if (!this.pendingIceCandidates.has(fromUserId)) {
          this.pendingIceCandidates.set(fromUserId, []);
        }
        this.pendingIceCandidates.get(fromUserId)!.push(candidate);
        console.log('🧊 ICE candidate queued for:', fromUserId);
      } else {
        console.warn('⚠️ No peer connection found for ICE candidate from:', fromUserId);
      }

    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  // Handle user joined
  private async handleUserJoined(data: any) {
    try {
      const { userId } = data;
      if (userId === this.userId) return; // Skip self

      console.log('👤 User joined voice room:', userId);

      // Check if we already have a connection with this user
      if (this.peerConnections.has(userId)) {
        console.log('🔄 Already have connection with:', userId);
        return;
      }

      console.log('🔄 Creating peer connection and offer for:', userId);

      // Create offer for new user
      const pc = await this.createPeerConnection(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('📤 Sending WebRTC offer to:', userId);
      this.wsService.send({
        type: 'webrtc_offer',
        data: {
          offer,
          targetUserId: userId,
          fromUserId: this.userId
        }
      });

    } catch (error) {
      console.error('❌ Error handling user joined:', error);
    }
  }

  // Handle user left
  private handleUserLeft(data: any) {
    const { userId } = data;
    console.log('👋 User left voice room:', userId);
    
    // Close peer connection
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
    }
    
    // Remove user
    this.remoteUsers.delete(userId);
    this.onUserLeft?.(userId);
  }

  // Start voice activity detection
  private startVoiceActivityDetection() {
    if (!this.localStream || this.isMonitoringVoice) return;
    
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      
      this.analyser.fftSize = 256;
      source.connect(this.analyser);
      
      this.isMonitoringVoice = true;
      this.monitorVoiceActivity();
      
    } catch (error) {
      console.error('❌ Error starting voice activity detection:', error);
    }
  }

  // Monitor voice activity
  private monitorVoiceActivity() {
    if (!this.analyser || !this.isMonitoringVoice) return;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const checkActivity = () => {
      if (!this.isMonitoringVoice) return;
      
      this.analyser!.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const level = Math.round(average * 10) / 10;
      
      const isSpeaking = level > this.voiceActivityThreshold;
      const now = Date.now();

      // Only send voice activity if state changed or enough time passed
      const stateChanged = isSpeaking !== this.isSpeaking;
      const enoughTimePassed = now - this.lastVoiceActivitySent > this.voiceActivityDebounce;

      if (stateChanged || enoughTimePassed) {
        // Send voice activity
        if (this.onVoiceActivity && this.userId) {
          this.onVoiceActivity({
            userId: this.userId,
            level,
            isSpeaking
          });

          this.lastVoiceActivitySent = now;
          this.isSpeaking = isSpeaking;

          // Only log state changes, not every update
          if (stateChanged) {
            console.log('🎤 Voice activity changed:', isSpeaking ? 'speaking' : 'silent', `(level: ${level})`);
          }
        }
      }
      
      requestAnimationFrame(checkActivity);
    };
    
    checkActivity();
  }

  // Stop voice activity detection
  private stopVoiceActivityDetection() {
    this.isMonitoringVoice = false;

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
  }

  // Send offer to a specific user (public method)
  async sendOffer(targetUserId: string): Promise<void> {
    try {
      console.log('📤 Sending offer to:', targetUserId);

      if (!this.isJoined || !this.userId) {
        console.warn('⚠️ Not joined to voice room, cannot send offer');
        return;
      }

      // Check if we already have a connection
      let pc = this.peerConnections.get(targetUserId);
      if (pc && pc.signalingState !== 'stable') {
        console.log('🔄 Closing existing unstable connection with:', targetUserId);
        pc.close();
        this.peerConnections.delete(targetUserId);
        pc = null;
      }

      if (!pc) {
        pc = await this.createPeerConnection(targetUserId);
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('📤 Sending WebRTC offer to:', targetUserId);
      this.wsService.send({
        type: 'webrtc_offer',
        data: {
          offer,
          targetUserId,
          fromUserId: this.userId
        }
      });

    } catch (error) {
      console.error('❌ Error sending offer to:', targetUserId, error);
    }
  }

  // Process pending ICE candidates
  private async processPendingIceCandidates(userId: string): Promise<void> {
    const candidates = this.pendingIceCandidates.get(userId);
    if (candidates && candidates.length > 0) {
      console.log(`🧊 Processing ${candidates.length} pending ICE candidates for:`, userId);

      const pc = this.peerConnections.get(userId);
      if (pc && pc.remoteDescription) {
        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(candidate);
            console.log('🧊 Added pending ICE candidate for:', userId);
          } catch (error) {
            console.error('❌ Error adding pending ICE candidate:', error);
          }
        }
      }

      // Clear processed candidates
      this.pendingIceCandidates.delete(userId);
    }
  }

  // Getters
  get isConnected(): boolean {
    return this.isJoined;
  }

  get mutedState(): boolean {
    return this.isMuted;
  }

  get connectedUsers(): VoiceUser[] {
    return Array.from(this.remoteUsers.values());
  }

  // Cleanup method for React component unmount
  cleanup() {
    this.leaveRoom().catch(console.error);
  }
}
