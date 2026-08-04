const LOCAL_API_URL = 'http://localhost:3000/api';
const LOCAL_SOCKET_URL = 'http://localhost:3000';

export class EnvironmentService {
  static isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  static isProduction(): boolean {
    return import.meta.env.PROD;
  }

  static getApiBaseUrl(): string {
    return import.meta.env.VITE_API_URL || LOCAL_API_URL;
  }

  static getSocketUrl(): string {
    return import.meta.env.VITE_SOCKET_URL || LOCAL_SOCKET_URL;
  }
}
