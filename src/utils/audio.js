// Onyx Signal: Professional Audio Capture Logic

export class OnyxRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioContext = null;
    this.analyser = null;
    this.stream = null;
  }

  async start(fidelity = 'PRO LOSSLESS') {
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2, // Stereo capture
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
    
    // MediaRecorder options
    const options = {
      mimeType: fidelity === 'PRO_LOSSLESS' ? 'audio/webm;codecs=opus' : 'audio/webm;codecs=opus',
      audioBitsPerSecond: fidelity === 'PRO_LOSSLESS' ? 512000 : 128000
    };

    this.mediaRecorder = new MediaRecorder(this.stream, options);
    this.audioChunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };

    this.mediaRecorder.start();
  }

  stop() {
    return new Promise((resolve) => {
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Clean up
        this.stream.getTracks().forEach(track => track.stop());
        this.audioContext.close();
        
        resolve({ blob: audioBlob, url: audioUrl });
      };
      this.mediaRecorder.stop();
    });
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}
