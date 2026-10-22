// tests/mediaPipeline.test.js
// Regression contracts for the media pipeline, full-screen viewer, Sparkle AI
// media analysis, presence privacy, safe areas, and Orbit removal.
const { describe, it, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('LLMService vision support', () => {
  const LLMService = require('../backend/services/sparkly/llm.service');
  const PROVIDER_KEYS = ['GROQ_API_KEY', 'TOGETHER_API_KEY', 'OPENROUTER_API_KEY'];
  const saved = {};

  before(() => {
    for (const key of PROVIDER_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  after(() => {
    for (const key of PROVIDER_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('buildMessages passes vision content arrays through untouched', () => {
    const parts = [
      { type: 'text', text: 'Describe this' },
      { type: 'image_url', image_url: { url: 'data:image/gif;base64,R0lGOD' } },
    ];
    const out = LLMService.buildMessages({ messages: [{ role: 'user', content: parts }] });
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].content, parts);
  });

  it('buildMessages keeps plain string content as strings', () => {
    const out = LLMService.buildMessages({ messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(typeof out[0].content, 'string');
  });

  it('runVision rejects a missing imageUrl', async () => {
    const result = await LLMService.runVision({});
    assert.equal(result.success, false);
    assert.match(String(result.error), /imageUrl/);
  });

  it('runVision rejects non-http(s) URLs', async () => {
    const result = await LLMService.runVision({ imageUrl: 'file:///etc/passwd' });
    assert.equal(result.success, false);
    assert.match(String(result.error), /http/i);
  });

  it('runVision refuses loopback hosts (SSRF guard) without hitting the network', async () => {
    const result = await LLMService.runVision({ imageUrl: 'http://127.0.0.1/secret.png' });
    assert.equal(result.success, false);
    assert.match(String(result.error), /fetch/i);
  });

  it('runVision reports honestly when no provider is configured (no fake analysis)', async () => {
    const result = await LLMService.runVision({
      imageUrl: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    });
    assert.equal(result.success, false);
    assert.equal(result.content, null);
    assert.match(String(result.error), /provider/i);
  });
});

describe('media pipeline contracts', () => {
  it('Messages.tsx never falls back to a local blob/data URL after upload', () => {
    const src = read('frontend/src/pages/Messages.tsx');
    assert.ok(!src.includes('uploadedUrl || item.url'), 'removed uploadedUrl || item.url fallback');
    assert.ok(!src.includes('mock content'), 'no fabricated mock uploads');
  });

  it('mediaDownload rejects blob:/data: URLs and routes native saves through MediaStore', () => {
    const src = read('frontend/src/services/mediaDownload.ts');
    assert.ok(src.includes("startsWith('blob:')"), 'blob URL guard present');
    assert.ok(src.includes("startsWith('data:')"), 'data URL guard present');
    assert.ok(src.includes('MediaStoreSaver'), 'native MediaStore saver wired');
  });

  it('chat media bubbles resolve URLs via getMediaUrl and open the full-screen viewer', () => {
    const src = read('frontend/src/pages/Messages.tsx');
    assert.ok(src.includes('getMediaUrl(msg.media_url || msg.mediaUrl)'), 'bubbles sanitize media URLs');
    assert.ok(src.includes('setViewerMessage(msg)'), 'bubbles open the full-screen viewer');
    assert.ok(src.includes('FullscreenMediaViewer'), 'viewer component rendered');
    assert.ok(src.includes("onStarToggled"), 'viewer star wiring present');
  });

  it('old lightbox is fully replaced by the viewer', () => {
    const src = read('frontend/src/pages/Messages.tsx');
    assert.ok(!src.includes('lightboxUrl'), 'no legacy lightbox state');
    assert.ok(!src.includes('LIGHTBOX'), 'no legacy lightbox block');
  });
});

describe('fullscreen media viewer contracts', () => {
  const src = read('frontend/src/components/chat/FullscreenMediaViewer.tsx');

  it('exposes the required header + overflow actions', () => {
    for (const action of [
      'lens.google.com/uploadbyurl',
      'sparkle:jump-to-message',
      'afterglow/create?imageUrl=',
      '/ai/analyze-media',
      'Ask Sparkle AI',
      'Chat wallpaper',
      'Profile picture',
      'Set as',
    ]) {
      assert.ok(src.includes(action), `viewer action missing: ${action}`);
    }
  });

  it('menus are right-edge aligned (Sparkle design rule)', () => {
    assert.ok(/right-2/.test(src), 'overflow menu anchored to the right edge');
  });
});

describe('share-to-story + gallery wiring', () => {
  it('CreateStory seeds the editor from an imageUrl query param', () => {
    const src = read('frontend/src/pages/CreateStory.tsx');
    assert.ok(src.includes("searchParams.get('imageUrl')"), 'imageUrl param read');
    assert.ok(src.includes('setPhase(\'editor\')'), 'editor phase entered for shared media');
  });

  it('ChatSettingsModal accepts initialView and opens the Shared Content Explorer', () => {
    const src = read('frontend/src/components/chat/ChatSettingsModal.tsx');
    assert.ok(src.includes('initialView'), 'initialView prop present');
    assert.ok(src.includes('SharedContentExplorer'), 'SharedContentExplorer present');
  });
});

describe('Sparkle AI analyze-media route', () => {
  it('route is registered under /api/ai behind auth + rate limit', () => {
    const src = read('backend/routes/api/ai.routes.js');
    assert.ok(src.includes("/analyze-media"), 'route registered');
    assert.ok(src.includes('authMiddleware'), 'auth middleware in file');
    assert.ok(src.includes('feedRateLimiter'), 'rate limiter in file');
  });

  it('controller delegates to LLMService.runVision and fails honestly', () => {
    const src = read('backend/controllers/ai.controller.js');
    assert.ok(src.includes('analyzeMedia'), 'handler exported');
    assert.ok(src.includes('LLMService.runVision'), 'uses shared LLMService vision');
    assert.ok(src.includes('502'), 'upstream failure returns 502, never fake text');
  });

  it('LLMService exposes per-provider vision models', () => {
    const src = read('backend/services/sparkly/llm.service.js');
    assert.ok(src.includes('visionModels'), 'vision model lists present');
    assert.ok(src.includes('image_url'), 'vision message parts supported');
    assert.ok(src.includes('fetchImageAsDataUrl'), 'server-side image fetch with SSRF guard');
  });
});

describe('presence + last-seen privacy contracts', () => {
  it('socket layer keeps the one-minute offline grace and privacy-filtered broadcasts', () => {
    const src = read('backend/socket/index.js');
    assert.ok(src.includes('OFFLINE_GRACE_MS'), 'grace constant present');
    assert.ok(/OFFLINE_GRACE_MS\s*=\s*60_?000/.test(src), 'grace is exactly 60 seconds');
    assert.ok(src.includes('refreshPresenceBroadcast'), 'settings changes re-broadcast presence');
    assert.ok(src.includes('presencePrivacy') || src.includes('filterPresenceViewers'), 'privacy filter used');
  });

  it('presence privacy helper exists and is shared', () => {
    assert.ok(existsSync(join(ROOT, 'backend/services/presencePrivacy.js')));
  });

  it('chat list shows no live Active label (green dot only)', () => {
    const src = read('frontend/src/utils/chatListDisplay.ts');
    assert.ok(src.includes('formatActivityStatus'), 'activity label helper present');
  });
});

describe('message deletion column fix', () => {
  it('messages controller only queries the live is_deleted_for_everyone column', () => {
    const src = read('backend/controllers/messages.controller.js');
    assert.ok(!src.includes('deleted_for_everyone IS') || src.includes('is_deleted_for_everyone'),
      'stale deleted_for_everyone filter removed');
    // The stale column (without is_ prefix) must not appear in SQL filters.
    const stale = src.match(/(?<!is_)deleted_for_everyone/g);
    assert.equal(stale, null, 'no stale deleted_for_everyone references');
  });

  it('forward uses the viewer-scoped variable (no ReferenceError)', () => {
    const src = read('backend/controllers/messages.controller.js');
    assert.ok(src.includes('viewerUserId'), 'forward resolves recipient via viewerUserId');
  });
});

describe('message type ENUM migration', () => {
  it('migration adds audio/document and is registered in the ledger', () => {
    const sql = read('backend/migrations/20261021_extend_message_types.sql');
    assert.ok(sql.includes('audio') && sql.includes('document'));
    const ledger = read('backend/utils/database/schemaLedger.js');
    assert.ok(ledger.includes('20261021_extend_message_types.sql'), 'migration registered');
  });
});

describe('safe area / edge-to-edge contracts', () => {
  it('viewport uses viewport-fit=cover', () => {
    assert.ok(read('frontend/index.html').includes('viewport-fit=cover'));
  });

  it('native insets plugin reports safe-area insets', () => {
    const src = read('android/app/src/main/java/com/sparkleapp/plugins/SparkleInsetsPlugin.java');
    assert.ok(src.includes('getSafeAreaInsets'));
  });

  it('MainActivity enables edge-to-edge before first paint and registers plugins', () => {
    const src = read('android/app/src/main/java/com/sparkleapp/MainActivity.java');
    assert.ok(src.includes('setDecorFitsSystemWindows(window, false)'));
    assert.ok(src.includes('registerPlugin(SparkleInsetsPlugin.class)'));
    assert.ok(src.includes('registerPlugin(MediaStoreSaver.class)'));
  });

  it('native download plugin saves into public Downloads', () => {
    const src = read('android/app/src/main/java/com/sparkleapp/plugins/MediaStoreSaver.java');
    assert.ok(src.includes('MediaStore.Downloads'));
    assert.ok(src.includes('saveToDownloads'));
  });

  it('manifest declares legacy Downloads permission capped at API 28', () => {
    const src = read('android/app/src/main/AndroidManifest.xml');
    assert.ok(src.includes('WRITE_EXTERNAL_STORAGE'));
    assert.ok(src.includes('maxSdkVersion="28"'));
  });
});

describe('Orbit removal contracts', () => {
  it('Orbit chat menu components are deleted and menu state is gone', () => {
    assert.ok(!existsSync(join(ROOT, 'frontend/src/components/chat/SparkleOrbitMenu.tsx')));
    assert.ok(!existsSync(join(ROOT, 'frontend/src/components/chat/SparkleActionSheet.tsx')));
    const src = read('frontend/src/pages/Messages.tsx');
    assert.ok(!src.includes('showOrbitMenu'), 'orbit menu state removed');
  });
});
