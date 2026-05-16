export default function MobileBanner() {
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (!isStandalone) return null;

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: `calc(44px + env(safe-area-inset-top))`,
      paddingTop: 'env(safe-area-inset-top)',
      background: 'var(--purple)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      zIndex: 150,
      boxShadow: '0 1px 8px rgba(83,74,183,0.3)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
      }}>K</div>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: 0.3 }}>
        Kvitto
      </span>
      {version && (
        <span style={{
          fontSize: 10, color: 'rgba(255,255,255,0.5)',
          position: 'absolute', right: 14, bottom: 8,
        }}>
          v{version}
        </span>
      )}
    </div>
  );
}
