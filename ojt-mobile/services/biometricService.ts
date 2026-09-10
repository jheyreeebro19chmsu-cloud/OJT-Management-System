/**
 * Biometric Verification Service for React Native (Option A: 100% On-Device)
 *
 * Dispatches facial recognition and landmark verification tasks to the
 * headless BiometricBridge running face-api.js.
 */

export interface BiometricMatchResult {
  matched: boolean;
  distance: number;
  confidence: number;
  error?: string;
}

export interface BiometricQualityResult {
  hasFace: boolean;
  tooDark: boolean;
  tooBright: boolean;
  brightness: number;
  faceCentered?: boolean;
  capDetected?: boolean;
  glassesDetected?: boolean;
  maskDetected?: boolean;
  faceObscured?: boolean;
  error?: string;
}

type BridgeSender = (msg: any) => void;

class BiometricService {
  private sender: BridgeSender | null = null;
  private isBridgeReady = false;
  private readyCallbacks: Array<() => void> = [];
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: any) => void;
      reject: (err: any) => void;
      timeout: any;
    }
  >();

  /**
   * Register the headless bridge sender function (called by BiometricBridge component)
   */
  public registerBridge(sender: BridgeSender) {
    this.sender = sender;
  }

  /**
   * Mark bridge as ready when face-api models are fully loaded
   */
  public setBridgeReady(ready: boolean) {
    this.isBridgeReady = ready;
    if (ready) {
      this.readyCallbacks.forEach((cb) => cb());
      this.readyCallbacks = [];
    }
  }

  public isReady(): boolean {
    return this.isBridgeReady;
  }

  /**
   * Wait until the background neural models are loaded
   */
  public async waitForReady(maxWaitMs = 12000): Promise<boolean> {
    if (this.isBridgeReady) return true;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(this.isBridgeReady);
      }, maxWaitMs);

      this.readyCallbacks.push(() => {
        clearTimeout(timer);
        resolve(true);
      });
    });
  }

  /**
   * Handle incoming messages from the headless WebView bridge
   */
  public handleBridgeMessage(data: any) {
    if (!data) return;

    if (data.type === 'BRIDGE_READY') {
      this.setBridgeReady(true);
      return;
    }

    if (!data.id) return;

    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(data.id);

    if (data.error && !data.matched) {
      pending.resolve({
        matched: false,
        distance: data.distance ?? Infinity,
        confidence: 0,
        error: data.error,
      });
    } else {
      pending.resolve(data);
    }
  }

  /**
   * Verify matching between registered template photo and live captured photo
   * Enforces 128-D Euclidean distance threshold (default: 0.55).
   */
  public async verifyBiometrics(
    registeredPhoto: string,
    livePhoto: string,
    threshold = 0.55
  ): Promise<BiometricMatchResult> {
    if (!registeredPhoto || !livePhoto) {
      return {
        matched: false,
        distance: Infinity,
        confidence: 0,
        error: 'Missing registered photo or live capture image',
      };
    }

    const ready = await this.waitForReady();
    if (!ready || !this.sender) {
      return {
        matched: false,
        distance: Infinity,
        confidence: 0,
        error: 'Biometric engine is still initializing. Please hold steady and try again.',
      };
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<BiometricMatchResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        resolve({
          matched: false,
          distance: Infinity,
          confidence: 0,
          error: 'Biometric processing timed out (15s). Please ensure good lighting and try again.',
        });
      }, 15000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sender!({
        id,
        action: 'VERIFY',
        registered: registeredPhoto,
        live: livePhoto,
        threshold,
      });
    });
  }

  /**
   * Detect face and inspect environmental quality (brightness / glare / presence)
   */
  public async inspectQuality(photo: string): Promise<BiometricQualityResult> {
    if (!photo) {
      return {
        hasFace: false,
        tooDark: false,
        tooBright: false,
        brightness: 0,
        error: 'No image provided',
      };
    }

    const ready = await this.waitForReady();
    if (!ready || !this.sender) {
      return {
        hasFace: true,
        tooDark: false,
        tooBright: false,
        brightness: 128,
      };
    }

    const id = `qual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<BiometricQualityResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        resolve({
          hasFace: true,
          tooDark: false,
          tooBright: false,
          brightness: 128,
        });
      }, 8000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sender!({
        id,
        action: 'INSPECT',
        photo,
      });
    });
  }
}

export const biometricService = new BiometricService();
