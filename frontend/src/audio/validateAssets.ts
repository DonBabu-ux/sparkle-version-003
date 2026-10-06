import type { SoundTheme } from './settings/ThemeController';
import { logger } from '../utils/logger';

export interface ValidationWarning {
  type: 'missing' | 'duplicate' | 'format' | 'size' | 'samplerate';
  file: string;
  message: string;
}

const REQUIRED_ASSETS = [
  'send message .mp3',
  'inchat message receive.mp3',
  'outchat notification.mp3',
  'sparkle like notification.mp3',
  'comment pop.mp3',
  'new follower .mp3',
  'sparkle Facebook notification.mp3',
  'iphone.mp3',
];


const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB limit
const EXPECTED_SAMPLE_RATE = 44100; // 44.1 kHz

/**
 * Validates audio assets for a specific theme.
 * Checks for missing files, incorrect format, oversized files, and sample rate consistency.
 */
export async function validateAssets(
  themeName: SoundTheme,
  audioContext: AudioContext
): Promise<ValidationWarning[]> {
  const warnings: ValidationWarning[] = [];
  const themeDir = themeName === 'Sparkle Original' ? '' : `themes/${themeName.toLowerCase().replace(' ', '_')}/`;

  // 1. Check for duplicates in REQUIRED_ASSETS (just a sanity check)
  const uniqueAssets = new Set(REQUIRED_ASSETS);
  if (uniqueAssets.size !== REQUIRED_ASSETS.length) {
    warnings.push({
      type: 'duplicate',
      file: 'REQUIRED_ASSETS',
      message: 'Duplicate filename exists in required asset list config',
    });
  }

  // 2. Fetch and check each asset
  for (const filename of REQUIRED_ASSETS) {
    const path = `/sounds/${themeDir}${filename}`;

    // Format validation
    if (!filename.endsWith('.mp3')) {
      warnings.push({
        type: 'format',
        file: filename,
        message: 'Unsupported format. Assets must be in .mp3 format.',
      });
      continue;
    }

    try {
      const response = await fetch(path);
      if (!response.ok) {
        warnings.push({
          type: 'missing',
          file: filename,
          message: `Asset not found at: ${path}`,
        });
        continue;
      }

      // Check file size (Content-Length header)
      const contentLength = response.headers.get('Content-Length');
      if (contentLength) {
        const sizeBytes = parseInt(contentLength, 10);
        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
          warnings.push({
            type: 'size',
            file: filename,
            message: `Oversized asset (${(sizeBytes / 1024).toFixed(1)} KB). Limit is 1 MB.`,
          });
        }
      }

      // Check sample rate by decoding a small snippet or full data
      const arrayBuffer = await response.clone().arrayBuffer();
      // Decode the buffer
      try {
        const decoded = await audioContext.decodeAudioData(arrayBuffer);
        if (decoded.sampleRate !== EXPECTED_SAMPLE_RATE) {
          warnings.push({
            type: 'samplerate',
            file: filename,
            message: `Inconsistent sample rate: ${decoded.sampleRate} Hz. Expected ${EXPECTED_SAMPLE_RATE} Hz.`,
          });
        }
      } catch (err) {
        warnings.push({
          type: 'format',
          file: filename,
          message: `Failed to decode audio data. Format might be corrupted: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } catch (e) {
      warnings.push({
        type: 'missing',
        file: filename,
        message: `Network/Fetch error trying to access: ${path}`,
      });
    }
  }

  if (warnings.length > 0) {
    logger.warn(`[AssetValidation] Theme "${themeName}" asset checks failed:`, warnings);
  } else {
    logger.log(`[AssetValidation] Theme "${themeName}" validation passed successfully.`);
  }

  return warnings;
}
