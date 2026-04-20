import { User } from './user';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password?: string;
}

export interface SignupData extends User {
  password?: string;
}
