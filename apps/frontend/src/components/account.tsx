'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useGame } from '@/lib/store';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

type User = { id: string; email: string; name: string };
async function authRequest(action: string, body?: unknown): Promise<{ user: User | null }> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/${action}`,
    {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Arena-Request': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.message === 'string' ? data.message : 'Không thể thực hiện yêu cầu.',
    );
  return data;
}
export function Account() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void authRequest('me')
      .then(({ user }) => {
        if (!active) return;
        setUser(user);
        if (user) useGame.getState().set({ name: user.name });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (register && data.get('password') !== data.get('confirmPassword')) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { user } = await authRequest(register ? 'register' : 'login', {
        email: data.get('email'),
        password: data.get('password'),
        name: data.get('name'),
      });
      setUser(user);
      if (user) useGame.getState().set({ name: user.name });
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể kết nối máy chủ.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await authRequest('logout', {});
      setUser(null);
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Không thể đăng xuất.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        {user ? user.name : 'Đăng nhập'}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            setError('');
          }
        }}
        title={user ? 'Tài khoản của bạn' : register ? 'Tạo tài khoản' : 'Chào mừng trở lại'}
        description={
          user
            ? 'Thông tin huấn luyện viên của bạn.'
            : 'Tham gia Pokémon Arena cùng tài khoản của bạn.'
        }
      >
        {user ? (
          <div className="account-form">
            <strong>{user.name}</strong>
            <p>{user.email}</p>
            {error && <p role="alert">{error}</p>}
            <Button disabled={busy} onClick={() => void logout()}>
              {busy ? 'Đang xử lý…' : 'Đăng xuất'}
            </Button>
          </div>
        ) : (
          <form className="account-form" onSubmit={submit} key={String(register)}>
            {register && (
              <label>
                Tên huấn luyện viên
                <input name="name" autoComplete="nickname" required minLength={2} maxLength={30} />
              </label>
            )}
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required maxLength={254} />
            </label>
            <label>
              Mật khẩu
              <input
                name="password"
                type="password"
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={8}
                maxLength={128}
              />
            </label>
            {register && (
              <label>
                Xác nhận mật khẩu
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                />
              </label>
            )}
            {error && (
              <p className="account-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? 'Đang xử lý…' : register ? 'Đăng ký' : 'Đăng nhập'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError('');
              }}
            >
              {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
