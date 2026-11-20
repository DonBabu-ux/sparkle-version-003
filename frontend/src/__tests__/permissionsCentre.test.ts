import { describe, it, expect } from 'vitest';
import {
  PERMISSION_DEFINITIONS,
  PermissionService,
  type SparklePermission,
} from '../services/PermissionService';
import { PERMISSION_MODAL_CONFIG } from '../components/PermissionRequestModal';

describe('Permissions Centre & Smart Permission Request System', () => {
  const EXPECTED_PERMISSIONS: SparklePermission[] = [
    'camera',
    'microphone',
    'notifications',
    'media',
    'location',
    'contacts',
    'bluetooth',
  ];

  describe('PERMISSION_DEFINITIONS contract', () => {
    it('defines all 7 required platform permissions', () => {
      EXPECTED_PERMISSIONS.forEach((perm) => {
        expect(PERMISSION_DEFINITIONS[perm]).toBeDefined();
        expect(PERMISSION_DEFINITIONS[perm].id).toBe(perm);
        expect(PERMISSION_DEFINITIONS[perm].name.length).toBeGreaterThan(0);
        expect(PERMISSION_DEFINITIONS[perm].purpose.length).toBeGreaterThan(0);
      });
    });

    it('has user-friendly purpose descriptions', () => {
      expect(PERMISSION_DEFINITIONS.camera.purpose).toContain('Video calls');
      expect(PERMISSION_DEFINITIONS.microphone.purpose).toContain('Voice calls');
      expect(PERMISSION_DEFINITIONS.notifications.purpose).toContain('Messages');
      expect(PERMISSION_DEFINITIONS.media.purpose).toContain('media');
      expect(PERMISSION_DEFINITIONS.location.purpose).toContain('Location');
      expect(PERMISSION_DEFINITIONS.contacts.purpose).toContain('Contact discovery');
      expect(PERMISSION_DEFINITIONS.bluetooth.purpose).toContain('Audio device routing');
    });
  });

  describe('PERMISSION_MODAL_CONFIG prompt requirements', () => {
    it('provides clear explanation and action text for every permission', () => {
      EXPECTED_PERMISSIONS.forEach((perm) => {
        const config = PERMISSION_MODAL_CONFIG[perm];
        expect(config).toBeDefined();
        expect(config.title.length).toBeGreaterThan(0);
        expect(config.message.length).toBeGreaterThan(0);
        expect(config.actionText.length).toBeGreaterThan(0);
        expect(config.icon).toBeDefined();
      });
    });

    it('matches exact prompt copy for core media permissions', () => {
      expect(PERMISSION_MODAL_CONFIG.camera.title).toBe('Camera access required');
      expect(PERMISSION_MODAL_CONFIG.microphone.title).toBe('Microphone access required');
      expect(PERMISSION_MODAL_CONFIG.notifications.title).toBe('Stay connected');
      expect(PERMISSION_MODAL_CONFIG.media.title).toBe('Media access required');
      expect(PERMISSION_MODAL_CONFIG.camera.actionText).toBe('Enable camera');
      expect(PERMISSION_MODAL_CONFIG.microphone.actionText).toBe('Enable microphone');
      expect(PERMISSION_MODAL_CONFIG.notifications.actionText).toBe('Enable notifications');
      expect(PERMISSION_MODAL_CONFIG.media.actionText).toBe('Enable access');
    });
  });

  describe('PermissionService architecture', () => {
    it('provides checkPermission and requestPermission methods', () => {
      expect(typeof PermissionService.checkPermission).toBe('function');
      expect(typeof PermissionService.requestPermission).toBe('function');
      expect(typeof PermissionService.checkAllPermissions).toBe('function');
      expect(typeof PermissionService.openAppSettings).toBe('function');
      expect(typeof PermissionService.isNativeAndroid).toBe('function');
      expect(typeof PermissionService.subscribe).toBe('function');
    });

    it('returns valid initial cached statuses for all permissions', () => {
      const cached = PermissionService.getCachedPermissions();
      EXPECTED_PERMISSIONS.forEach((perm) => {
        expect(cached[perm]).toBeDefined();
      });
    });

    it('allows subscribing and unsubscribing to permission state changes', () => {
      let callCount = 0;
      const unsubscribe = PermissionService.subscribe(() => {
        callCount++;
      });
      expect(callCount).toBe(1); // Immediate initial notification
      unsubscribe();
    });
  });
});
