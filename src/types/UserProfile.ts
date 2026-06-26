import { VerifiedUser } from './VerifiedUser.js';

export interface UserProfile extends VerifiedUser {
  accountCreatedAt: string;
  joinedAt: string;
  gameRoles: string[];
}
