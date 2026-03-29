import { ImageResponse } from 'next/og';

import { BrandIconSvg } from '@/lib/brandIcon';
import { siteConfig } from '@/lib/seo';

export const dynamic = 'force-static';
export const alt = `${siteConfig.name} Twitter card`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #0f172a 0%, #111827 44%, #f8fafc 100%)',
          color: '#f8fafc',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 15% 18%, rgba(255, 211, 109, 0.28), transparent 24%), radial-gradient(circle at 82% 25%, rgba(84, 212, 255, 0.2), transparent 22%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            width: '100%',
            padding: '60px 64px',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              maxWidth: 760,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 20, letterSpacing: 5, textTransform: 'uppercase', color: '#cbd5e1' }}>
                Cheese TOEIC Command Deck
              </div>
              <div style={{ fontSize: 72, lineHeight: 1.02, fontWeight: 800 }}>Track faster. Review sharper. Share cleaner.</div>
              <div style={{ fontSize: 28, lineHeight: 1.45, color: '#e2e8f0' }}>
                为 TOEIC 冲刺设计的静态训练面板，适合链接分享、搜索收录与移动端快速打开。
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {['Plan', 'Timer', 'Analytics', 'Scores', 'Vault'].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 999,
                    padding: '12px 18px',
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontSize: 22,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <BrandIconSvg
              title={siteConfig.shortName}
              style={{
                width: 150,
                height: 150,
                boxShadow: '0 24px 56px rgba(15, 23, 42, 0.24)',
                borderRadius: 32,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'right' }}>
              <div style={{ fontSize: 22, color: '#cbd5e1' }}>Static export compatible</div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>{siteConfig.shortName}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}