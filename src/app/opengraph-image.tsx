import { ImageResponse } from 'next/og';

import { BrandIconSvg } from '@/lib/brandIcon';
import { siteConfig } from '@/lib/seo';

export const dynamic = 'force-static';
export const alt = `${siteConfig.name} social share image`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #fff8dc 0%, #eef9ff 42%, #0f172a 100%)',
          color: '#09090b',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 16% 18%, rgba(255, 196, 92, 0.34), transparent 28%), radial-gradient(circle at 78% 22%, rgba(84, 212, 255, 0.24), transparent 24%), linear-gradient(120deg, rgba(255,255,255,0.76), rgba(255,255,255,0.04))',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            width: '100%',
            padding: '56px 64px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
              }}
            >
              <BrandIconSvg
                title={siteConfig.shortName}
                style={{
                  width: 74,
                  height: 74,
                  boxShadow: '0 20px 48px rgba(15, 23, 42, 0.16)',
                  borderRadius: 22,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 18, letterSpacing: 4, textTransform: 'uppercase', color: '#475569' }}>
                  TOEIC Sprint Workspace
                </div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{siteConfig.shortName}</div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                borderRadius: 999,
                padding: '10px 18px',
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(148, 163, 184, 0.32)',
                fontSize: 18,
                color: '#334155',
              }}
            >
              Static-ready • SEO-ready • Share-ready
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              maxWidth: 840,
            }}
          >
            <div style={{ fontSize: 68, lineHeight: 1.02, fontWeight: 800 }}>TOEIC 20天冲刺训练看板</div>
            <div style={{ fontSize: 28, lineHeight: 1.45, color: '#334155' }}>
              把 session 排布、严格计时、错题复盘、未完成题追踪与实时估分集中到一个轻量的静态工作台。
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {['20-day plan', 'strict timer', 'loss diagnostics', 'score estimate', 'data sync'].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 18,
                  padding: '12px 18px',
                  background: 'rgba(9, 9, 11, 0.72)',
                  color: '#fafafa',
                  fontSize: 22,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}