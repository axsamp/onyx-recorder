// Onyx Signal: Professional Audio Capture Logic
// Optimized for iOS and Desktop with multi-codec support

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
      'audio/mp4;codecs=mp4a.40.2', // iOS Primary
      'audio/aac',                  // iOS Fallback
      'audio/webm;codecs=opus',     // Chrome/Android
      'audio/ogg;codecs=opus'       // Firefox
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  async start(fidelity = 'PRO LOSSLESS') {
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000
      } 
    });
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000
    });
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
    
    this.analyser.fftSize = 256;
    
    this.mimeType = this.getBestMimeType();
    
    const options = {
      mimeType: this.mimeType,
      audioBitsPerSecond: fidelity === 'PRO LOSSLESS' ? 512000 : 128000
    };

    this.mediaRecorder = new MediaRecorder(this.stream, options);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Start with 1s timeslice to ensure consistent data capturing on mobile
    this.mediaRecorder.start(1000);
  }

  stop() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: this.mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Clean up tracks but keep context if needed for visualizer (though we close it here)
        this.stream.getTracks().forEach(track => track.stop());
        if (this.audioContext.state !== 'closed') {
          this.audioContext.close();
        }
        
        resolve({ blob: audioBlob, url: audioUrl, type: this.mimeType });
      };
      this.mediaRecorder.stop();
    });
  }

  getFrequencyData() {
    if (!this.analyser || this.audioContext?.state === 'closed') return new Uint8Array(40).fill(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}
