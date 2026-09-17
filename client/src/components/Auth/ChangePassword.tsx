import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';
import { Alert, Button, Card, Field, Input } from '../ui';
import { KeyRound } from 'lucide-react';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, clearMustChangePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isForced = Boolean(user?.mustChangePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      clearMustChangePassword();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{isForced ? 'Set a new password' : 'Change password'}</h1>
            <p className="text-sm text-slate-500">
              {isForced ? 'For security, you must set your own password before continuing.' : 'Update your account password.'}
            </p>
          </div>
        </div>

        {error && <Alert tone="danger" className="mb-4">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Current password">
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
              required
            />
          </Field>
          <Button type="submit" loading={isLoading} className="w-full">
            {isForced ? 'Continue' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}