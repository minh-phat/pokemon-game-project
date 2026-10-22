'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useGame } from '@/lib/store';
import { useLanguage } from '@/lib/i18n';
import { leaveRoom } from '@/lib/network';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

type User = { id: string; email: string; name: string };
class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function authRequest(action: string, body?: unknown): Promise<{ user: User | null }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/${action}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Arena-Request': '1' },
      signal: AbortSignal.timeout(12000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new AuthError(response.status, typeof data.message === 'string' ? data.message : '');
  return data;
}

/** Single session controller, shared by the welcome screen, lobby and game header. */
export function Account() {
  const { user, accountView, set } = useGame();
  const { t } = useLanguage();
  const register = accountView === 'register';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let active = true;
    void authRequest('me')
      .then(({ user }) => {
        if (active) useGame.getState().set({ user, ...(user ? { name: user.name } : {}) });
      })
      .catch(() => {})
      .finally(() => {
        if (active) useGame.getState().set({ authLoading: false });
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    setError(null);
  }, [accountView]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    if (register && data.get('password') !== data.get('confirmPassword')) {
      setError('mismatch');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user } = await authRequest(register ? 'register' : 'login', {
        email: data.get('email'),
        password: data.get('password'),
        name: data.get('name'),
      });
      if (!user) throw new Error('No session returned');
      set({ user, name: user.name, accountView: null });
      if (useGame.getState().sessionId) leaveRoom();
      useGame.getState().go('home');
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await authRequest('logout', {});
      if (useGame.getState().sessionId) leaveRoom();
      set({ user: null, name: 'Trainer', accountView: null, team: [], snapshot: null });
      useGame.getState().go('home');
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  const errorMessage =
    error === 'mismatch'
      ? t('Mật khẩu xác nhận không khớp.', 'Passwords do not match.')
      : error instanceof AuthError
        ? error.status === 401
          ? t('Email hoặc mật khẩu không đúng.', 'Incorrect email or password.')
          : error.status === 409
            ? t('Email đã được đăng ký.', 'This email is already registered.')
            : error.status >= 500
              ? t(
                  'Dịch vụ tài khoản tạm thời không khả dụng. Vui lòng thử lại sau.',
                  'The account service is temporarily unavailable. Please try again later.',
                )
              : t(
                  error.message || 'Yêu cầu không hợp lệ.',
                  'Please check your details and try again.',
                )
        : t(
            'Không thể kết nối máy chủ. Vui lòng thử lại.',
            'Unable to reach the server. Please try again.',
          );
  return (
    <Dialog
      open={accountView !== null}
      onOpenChange={(open) => {
        if (!busy && !open) set({ accountView: null });
      }}
      title={
        user
          ? t('Tài khoản của bạn', 'Your account')
          : register
            ? t('Tạo tài khoản', 'Create an account')
            : t('Chào mừng trở lại', 'Welcome back')
      }
      description={
        user
          ? t('Thông tin nhà triệu hồi của bạn.', 'Your summoner profile.')
          : t(
              'Bắt đầu hành trình trong thế giới Triệu Hồi Sư.',
              'Start your journey in the world of Summoner.',
            )
      }
    >
      {user ? (
        <div className="account-form">
          <strong>{user.name}</strong>
          <p>{user.email}</p>
          {!!error && (
            <p className="account-error" role="alert">
              {errorMessage}
            </p>
          )}
          <Button disabled={busy} onClick={() => void logout()}>
            {busy ? t('Đang xử lý…', 'Please wait…') : t('Đăng xuất', 'Log out')}
          </Button>
        </div>
      ) : (
        <form className="account-form" onSubmit={submit} key={String(register)} aria-busy={busy}>
          {register && (
            <label>
              {t('Tên nhà triệu hồi', 'Summoner name')}
              <input
                name="name"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={30}
                disabled={busy}
              />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={busy}
            />
          </label>
          <label>
            {t('Mật khẩu', 'Password')}
            <input
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              minLength={8}
              maxLength={128}
              disabled={busy}
            />
          </label>
          {register && (
            <label>
              {t('Xác nhận mật khẩu', 'Confirm password')}
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                disabled={busy}
              />
            </label>
          )}
          {!!error && (
            <p className="account-error" role="alert">
              {errorMessage}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? t('Đang xử lý…', 'Please wait…')
              : register
                ? t('Đăng Ký', 'Sign Up')
                : t('Đăng Nhập', 'Log In')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => set({ accountView: register ? 'login' : 'register' })}
          >
            {register
              ? t('Đã có tài khoản? Đăng nhập', 'Already have an account? Log in')
              : t('Chưa có tài khoản? Đăng ký', 'New here? Sign up')}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
