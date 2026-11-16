import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Film, Play, RefreshCw, User } from './icons';
import './AccountManagement.css';

export default function AccountManagement({ active = true }) {
  const [account, setAccount] = useState(null);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('hongguo');
  const request = useRef(0);
  const historyRequest = useRef(0);
  const generation = useRef(0);
  const pollTimer = useRef(null);
  const visibleRows = rows.filter(row => !query.trim() || row.series_title.includes(query.trim()));

  const loadHistory = async (refresh = false) => {
    const version = ++historyRequest.current;
    setHistoryLoading(true);
    try {
      const result = await window.electronAPI.getAccountHistory?.({ refresh });
      if (version !== historyRequest.current) return;
      if (!result?.success) throw new Error(result?.error || 'APP 观看记录加载失败');
      setRows(result.signedIn ? result.results || [] : []);
      if (result.warning) setStatus(`已读取 APP 记录；${result.warning}`);
    } catch (failure) {
      if (version === historyRequest.current) setError(failure.message || 'APP 观看记录加载失败，请重试');
    } finally {
      if (version === historyRequest.current) setHistoryLoading(false);
    }
  };

  const load = async () => {
    const version = ++request.current;
    try {
      const result = await window.electronAPI.getAccountStatus?.();
      if (version !== request.current) return;
      if (!result?.success) throw new Error(result?.error || '账号状态读取失败');
      setAccount(result.account || null);
      setError(result.error || '');
      setLoading(false);
      if (result.signedIn) {
        await loadHistory();
      } else {
        historyRequest.current++;
        setRows([]);
      }
    } catch (failure) {
      if (version === request.current) setError(failure.message || '账号状态读取失败，请重试');
    } finally {
      if (version === request.current) {
        setLoading(false);
      }
    }
  };

  const schedulePoll = (loginId, token) => {
    clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
      if (token !== generation.current) return;
      try {
        const result = await window.electronAPI.pollAccountLogin?.(loginId);
        if (token !== generation.current) return;
        if (!result?.success) throw new Error(result?.error || '扫码状态读取失败');
        if (result.status === 'signed-in') {
          generation.current++;
          setBusy(false); setQr(null); setAccount(result.account || null);
          setStatus(result.storageWarning || '登录成功');
          loadHistory();
          return;
        }
        if (result.status === 'cancelled') { setBusy(false); setQr(null); setStatus('扫码已取消'); return; }
        if (result.status === 'expired') {
          setBusy(false); setQr(null); setError('二维码已过期，请重新获取。');
          return;
        }
        setStatus('等待手机确认扫码登录…');
        schedulePoll(loginId, token);
      } catch (failure) {
        if (token === generation.current) {
          setBusy(false); setQr(null);
          setError(failure.message || '扫码登录未完成，请重试');
        }
      }
    }, 1000);
  };

  const beginLogin = async () => {
    const token = ++generation.current;
    setBusy(true); setError(''); setStatus('正在获取红果登录二维码…');
    try {
      const result = await window.electronAPI.startAccountLogin?.();
      if (token !== generation.current) return;
      if (!result?.success) throw new Error(result?.error || '二维码获取失败');
      setQr({ id: result.loginId, image: result.image });
      setStatus(`请用手机红果 App 扫码，并在手机上确认登录。二维码约 ${result.expiresIn} 秒有效。`);
      schedulePoll(result.loginId, token);
    } catch (failure) {
      if (token === generation.current) {
        setBusy(false);
        setError(failure.message || '二维码获取失败，请重试');
      }
    }
  };

  const cancelLogin = async () => {
    generation.current++;
    clearTimeout(pollTimer.current);
    const id = qr?.id;
    setQr(null); setBusy(false); setStatus('已取消扫码登录');
    if (id) await window.electronAPI.cancelAccountLogin?.(id).catch(() => {});
  };

  const logout = async () => {
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await window.electronAPI.logoutAccount?.();
      if (!result?.success) throw new Error(result?.error || '退出账号失败');
      historyRequest.current++;
      setAccount(null); setRows([]); setQuery(''); setStatus('已退出红果账号，本机记录不受影响。');
    } catch (failure) { setError(failure.message || '退出账号失败，请重试'); }
    finally { setBusy(false); }
  };

  const open = async row => {
    if (!active || busy) return;
    setBusy(true); setError('');
    try {
      const result = await window.electronAPI.playAccountHistory?.(row.series_id);
      if (!result?.success) throw new Error(result?.error || '打开 APP 观看记录失败');
    } catch (failure) { setError(failure.message || '打开 APP 观看记录失败，请重试'); }
    finally { setBusy(false); }
  };

  const openHemaOfficial = async () => {
    setBusy(true); setError(''); setStatus('');
    try {
      const result = await window.electronAPI.openExternalUrl?.('https://www.kuaikaw.cn/');
      if (!result?.success) throw new Error(result?.error || '打开河马官方平台失败');
      setStatus('已打开河马官方平台，请在官方 App 或平台内登录并按账号权益解锁。');
    } catch (failure) { setError(failure.message || '打开河马官方平台失败，请重试'); }
    finally { setBusy(false); }
  };

  const selectSource = nextSource => {
    if (busy || nextSource === source) return;
    setSource(nextSource);
    setError(''); setStatus('');
  };

  useEffect(() => {
    if (active) load();
    return () => { request.current++; historyRequest.current++; };
  }, [active]);
  useEffect(() => window.electronAPI.onAccountUpdated?.(() => { if (active && source === 'hongguo') load(); }), [active, source]);
  useEffect(() => () => {
    generation.current++;
    clearTimeout(pollTimer.current);
  }, []);

  if (loading) return <div className="account-page"><p role="status">正在读取红果账号…</p></div>;

  return <div className="account-page">
    <div className="account-page-header">
      <User size={22} />
      <div><h2>登录账号</h2><p>分别管理红果与河马短剧账号；登录状态不会替代来源平台的会员或解锁权益。</p></div>
    </div>
    <div className="account-source-tabs" role="tablist" aria-label="账号来源">
      <button type="button" role="tab" aria-selected={source === 'hongguo'} aria-controls="hongguo-account-panel"
        className={`account-source-tab ${source === 'hongguo' ? 'is-active' : ''}`} disabled={busy} onClick={() => selectSource('hongguo')}>
        <User size={16} />红果账号
      </button>
      <button type="button" role="tab" aria-selected={source === 'hema'} aria-controls="hema-account-panel"
        className={`account-source-tab ${source === 'hema' ? 'is-active' : ''}`} disabled={busy} onClick={() => selectSource('hema')}>
        <Film size={16} />河马账号
      </button>
    </div>
    {source === 'hongguo' ? <>
      {!account && <div className="account-web-login"><button className="btn btn-outline" disabled={busy} onClick={async () => { try { const result = await window.electronAPI.openAccountWebLogin(); if (!result?.success) throw new Error(result?.error || '打开官网登录失败'); } catch(e) { setError(e.message); } }}>使用官网登录</button><p>手机提示二维码无效时，可打开官网并使用官网当前提供的登录方式。</p></div>}
    <section id="hongguo-account-panel" className="account-card" role="tabpanel" aria-label="红果账号状态">
      {account ? <>
        <div className="account-identity">
          <span className="account-avatar"><User size={24} /></span>
          <div><strong>{account.nickname}</strong><p>已登录红果账号</p></div>
        </div>
        <div className="account-summary">
          <span>APP 观看记录</span>
          <strong>{historyLoading && !rows.length ? '读取中' : `${rows.length} 部`}</strong>
          <small>最近 50 部；不会批量导入本机记录</small>
        </div>
        <div className="account-page-actions">
          <button className="btn btn-outline" type="button" disabled={busy || historyLoading} onClick={async () => {
            setBusy(true); setError(''); setStatus('');
            try { await loadHistory(true); } finally { setBusy(false); }
          }}><RefreshCw size={15} />刷新记录</button>
          <button className="btn btn-outline" type="button" disabled={busy} onClick={logout}>退出账号</button>
        </div>
        <div className="account-history-heading">
          <h3>观看记录</h3>
          <label>搜索<input className="input-field" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="输入剧名" /></label>
        </div>
        {historyLoading && !rows.length ? <div className="account-history-empty" role="status">正在读取 APP 观看记录…</div>
          : !rows.length ? <div className="account-history-empty">APP 还没有观看记录。</div>
          : !visibleRows.length ? <div className="account-history-empty">没有匹配的 APP 记录。</div>
          : <ul className="account-history-list">{visibleRows.map(row => <li key={row.series_id}>
            <button type="button" disabled={busy} onClick={() => open(row)} aria-label={`继续观看 ${row.series_title} 第${row.vid_index}集`}>
              <span className="account-history-cover">
                {row.cover && <img src={row.cover} alt="" loading="lazy" onError={event => event.currentTarget.remove()} />}
                <Play size={18} />
              </span>
              <span className="account-history-copy">
                <strong>{row.series_title}</strong>
                <small>看到第 {row.vid_index || '?'} 集{row.total ? ` / 共 ${row.total} 集` : ''} · {Math.floor(row.currentTime || 0)}:{String(Math.floor((row.currentTime || 0) % 60)).padStart(2, '0')}</small>
                <small>{row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '时间未知'}</small>
              </span>
              <span className="account-history-action"><Play size={14} />继续观看</span>
            </button>
          </li>)}</ul>}
      </> : <>
        <div className="account-login-copy">
          <h3>扫码登录</h3>
          <p>使用手机红果 App 扫码并确认。登录态由系统安全存储加密，普通资料备份不会包含账号凭据。</p>
        </div>
        {qr && <div className="account-qr"><img src={qr.image} alt="红果登录二维码" /><span>手机红果 App → 我的 → 扫一扫</span></div>}
        <div className="account-page-actions">
          {qr ? <button className="btn btn-outline" type="button" onClick={cancelLogin}>取消扫码</button>
            : <button className="btn btn-primary" type="button" disabled={busy} onClick={beginLogin}>{busy ? '正在获取二维码…' : '获取登录二维码'}</button>}
        </div>
      </>}
      {status && <p className="account-page-status" role="status">{status}</p>}
      {error && <div className="history-error" role="alert"><span>{error}</span></div>}
    </section>
    </> : <section id="hema-account-panel" className="account-card hema-account-card" role="tabpanel" aria-label="河马账号状态">
      <div className="account-provider-heading">
        <span className="account-provider-icon"><Film size={22} /></span>
        <div><h3>河马账号</h3><p>官方账号与看点、VIP 等来源权益分开管理。</p></div>
        <span className="account-source-badge">待接入</span>
      </div>
      <div className="account-notice account-notice-warning" role="note">
        <strong>当前未接入河马账号二维码登录</strong>
        <p>河马公开网页没有可复用的扫码授权接口，当前应用也没有河马会话或权益接口。这里不会显示不能实际完成登录的二维码。</p>
      </div>
      <div className="account-hema-copy">
        <h3>为什么后面的集数点不了？</h3>
        <p>当前河马来源把前 5 集作为公开片源，后续集数标记为收费或权益锁定。红果账号只用于红果 APP 观看记录，不能替代河马账号，也不会自动解锁河马全集。</p>
        <p>即使以后接入合法的河马登录，会不会能看第 6 集以后仍取决于官方账号的看点、VIP、广告或购买权益；应用会继续尊重来源返回的锁定状态。</p>
      </div>
      <div className="account-page-actions">
        <button className="btn btn-outline" type="button" disabled={busy} onClick={openHemaOfficial}><ExternalLink size={15} />打开河马官方平台</button>
      </div>
      {status && <p className="account-page-status" role="status">{status}</p>}
      {error && <div className="history-error" role="alert"><span>{error}</span></div>}
    </section>}
  </div>;
}
