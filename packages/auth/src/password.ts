import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password minimal 8 karakter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password harus mengandung huruf besar');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password harus mengandung huruf kecil');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password harus mengandung angka');
  }
  
  return { valid: errors.length === 0, errors };
}
