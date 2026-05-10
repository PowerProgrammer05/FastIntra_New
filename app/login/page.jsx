"use client";

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [memId, setMemId] = useState('');
  const [memPwd, setMemPwd] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [needsPin, setNeedsPin] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinValue = useMemo(() => pinDigits.join(''), [pinDigits]);

  async function handleLogin(event) {
    event.preventDefault();

    if (!memId.trim() || !memPwd.trim()) {
      setMessage('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memId, memPwd })
      });

      const data = await response.json();

      if (!response.ok || data.result !== 'success') {
        setMessage(data.resMsg || data.responseMessage || '로그인에 실패했습니다.');
        return;
      }

      if (data.isNewEnv) {
        setAccessToken(data?.AUTH_TOKEN?.ACCESS_TOKEN || '');
        setNeedsPin(true);
        setPendingMessage('본인확인번호 6자리를 입력해 주세요.');
        setMessage('');
        return;
      }

      if (data.isChgPwd) {
        setMessage('비밀번호 변경이 필요합니다. 로그인 후 비밀번호 변경 절차를 진행해 주세요.');
        return;
      }

      router.replace('/');
    } catch (error) {
      setMessage(error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function updatePin(index, value) {
    const sanitized = value.replace(/[^0-9]/g, '').slice(0, 1);
    setPinDigits((current) => {
      const next = [...current];
      next[index] = sanitized;
      return next;
    });
  }

  async function handlePinSubmit() {
    if (pinValue.length !== 6) {
      setMessage('본인확인번호 6자리를 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ memPinNum: pinValue, newEnv: true, accessToken })
      });

      const data = await response.json();

      if (!response.ok || data.result !== 'success') {
        setMessage(data.retMsg || data.resMsg || '본인확인번호 인증에 실패했습니다.');
        return;
      }

      setNeedsPin(false);
      router.replace('/');
    } catch (error) {
      setMessage(error.message || '본인확인번호 인증 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">Hana School</div>
        <h1>학사지원시스템 로그인</h1>
        <p>실제 하나고등학교 학사지원시스템 로그인 API에 연결된 화면입니다.</p>

        <form className="login-form" onSubmit={handleLogin}>
          <label>
            아이디
            <input
              value={memId}
              onChange={(event) => setMemId(event.target.value)}
              placeholder="아이디 입력"
              autoComplete="username"
            />
          </label>
          <label>
            비밀번호
            <input
              value={memPwd}
              onChange={(event) => setMemPwd(event.target.value)}
              type="password"
              placeholder="비밀번호 입력"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className="button button-primary" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </button>
          {message ? <p className="toast error">{message}</p> : null}
        </form>

        {needsPin ? (
          <section className="pin-modal">
            <h2>본인확인번호 입력</h2>
            <p>{pendingMessage}</p>
            <div className="pin-grid">
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  value={digit}
                  onChange={(event) => updatePin(index, event.target.value)}
                  inputMode="numeric"
                  maxLength={1}
                  type="password"
                />
              ))}
            </div>
            <button type="button" className="button button-primary" onClick={handlePinSubmit} disabled={submitting}>
              확인
            </button>
          </section>
        ) : null}
      </section>
    </main>
  );
}