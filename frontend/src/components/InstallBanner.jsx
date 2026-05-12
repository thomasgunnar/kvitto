import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Vis kun hvis ikke allerede installeret som PWA
    const isStandalone = window.navigator.standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone) return;

    // Tjek om det er iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    // Vis banner hvis ikke afvist inden for 7 dage
    const dismissed = localStorage.getItem('kvitto_install_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 3600 * 1000) return;

    // Vis efter 3 sekunder
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem('kvitto_install_dismissed', Date.now().toString());
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: `calc(16px + env(safe-area-inset-bottom))`,
      left: 16, right: 16,
      background: 'var(--bg-primary)',
      border: '0.5px solid var(--border-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      zIndex: 400,
      boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      {/* App ikon */}
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: '#534AB7',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 700, color: '#fff',
        flexShrink: 0,
      }}>K</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
          Installer Kvitto
        </div>
        {isIOS ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Tryk på <strong>Del</strong> <span style={{ fontSize: 14 }}>⬆</span> og vælg
            <strong> "Føj til hjemskærm"</strong> for at installere appen
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Tryk på menu-ikonet i browseren og vælg <strong>"Installer app"</strong>
          </div>
        )}
      </div>

      <button
        onClick={dismiss}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', fontSize: 20, lineHeight: 1,
          padding: '0 4px', flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
