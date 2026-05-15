// Onyx Signal: Professional Audio Capture Logic
// Optimized for iPhone 16 Pro 'Studio-quality' 4-mic array
// Dual-Fidelity Logic for Professional Archiving

export class OnyxRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
    this.mimeType = '';
  }

  getBestMimeType() {
    const types = [
      'audio/mp4;codecs=mp4a.40.2', // iOS Native High-Fidelity
      'audio/aac',                  // Standard AAC
      'audio/webm;codecs=opus',     // Android/Chrome
      'audio/ogg;codecs=opus'       // Firefox
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }

  async start(fidelity = 'PRO LOSSLESS') {
    // iPhone 16 Pro Microphone Optimization
    // We disable all processing to capture raw studio-quality audio in Lossless mode
    const isLossless = fidelity === 'PRO LOSSLESS';
    
    const constraints = {
      audio: {
        echoCancellation: !isLossless, // Disable for raw audio
        noiseSuppression: !isLossless, // Disable for raw audio
        autoGainControl: !isLossless,  // Disable for raw audio
        channelCount: 2,               // True Stereo
        sampleRate: 48000,             // Studio Standard
        sampleSize: 24,                // High Resolution
        latency: 0                     // Immediate capture
      }
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'playback' // Priority on audio quality over latency
      });

      this.analyser = this.audioContext.createAnalyser();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      this.analyser.fftSize = 256;
      
      this.mimeType = this.getBestMimeType();
      
      const options = {
        mimeType: this.mimeType,
        // High-bitrate for iPhone 16 Pro (512kbps for MP4 is exceptionally clean)
        audioBitsPerSecond: isLossless ? 512000 : 128000
      };

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      // 1-second timeslices ensure memory stability on long mobile recordings
      this.mediaRecorder.start(1000);
    } catch (err) {
      console.error("ONYX_AUDIO_ERROR:", err);
      throw err;
    }
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve({ url: null });
      
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Finalize tracks
        this.stream.getTracks().forEach(track => track.stop());
        if (this.audioContext && this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
        
        resolve({ blob: audioBlob, url: audioUrl, type: this.mimeType });
      };
      this.mediaRecorder.stop();
    });
  }

  getFrequencyData() {
    if (!this.analyser || !this.audioContext || this.audioContext.state === 'closed') {
      return new Uint8Array(40).fill(0);
    }
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}
