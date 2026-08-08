export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'support'
  | 'finance'
  | 'viewer';

export type AdminSummary = {
  id?: string;
  name: string;
  email: string;
  role: string;
};

export type AdminMeResponse = {
  ok?: boolean;
  signedIn?: boolean;
  isAdmin?: boolean;
  canBootstrap?: boolean;
  session?: boolean;
  email?: string;
  reason?: string;
  admin?: AdminSummary;
  clerk?: { email: string; name: string };
  error?: string;
};

export type AdminLoginResponse = {
  ok: true;
  sessionToken: string;
  expiresAt?: string;
  admin: AdminSummary;
};
