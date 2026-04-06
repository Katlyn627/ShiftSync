import { PageHeader } from '../components/ui/PageHeader';
import { Logo } from '../components/ui/Logo';

const ICON_SIZES = [16, 32, 57, 60, 72, 76, 96, 114, 120, 128, 144, 152, 180, 192, 384, 512, 1024];

const SPLASH_SIZES = [
  { file: 'splash-640x1136-iphone5.png',      label: 'iPhone 5/SE (1st gen)',  dims: '640 × 1136' },
  { file: 'splash-750x1334-iphone6.png',       label: 'iPhone 6/7/8',           dims: '750 × 1334' },
  { file: 'splash-1242x2208-iphone6plus.png',  label: 'iPhone 6+/7+/8+',        dims: '1242 × 2208' },
  { file: 'splash-1125x2436-iphoneX.png',      label: 'iPhone X / XS / 11 Pro', dims: '1125 × 2436' },
  { file: 'splash-828x1792-iphoneXR.png',      label: 'iPhone XR / 11',         dims: '828 × 1792' },
  { file: 'splash-1242x2688-iphoneXSMax.png',  label: 'iPhone XS Max / 11 Pro Max', dims: '1242 × 2688' },
  { file: 'splash-1170x2532-iphone12.png',     label: 'iPhone 12 / 13 / 14',   dims: '1170 × 2532' },
  { file: 'splash-1179x2556-iphone14.png',     label: 'iPhone 14 Pro / 15 / 15 Pro', dims: '1179 × 2556' },
  { file: 'splash-1290x2796-iphone14pro.png',  label: 'iPhone 14/15 Pro Max',   dims: '1290 × 2796' },
  { file: 'splash-1536x2048-ipad.png',         label: 'iPad / iPad Mini',        dims: '1536 × 2048' },
  { file: 'splash-1668x2388-ipadPro11.png',    label: 'iPad Pro 11"',            dims: '1668 × 2388' },
  { file: 'splash-2048x2732-ipadPro.png',      label: 'iPad Pro 12.9"',          dims: '2048 × 2732' },
];

export default function BrandAssetsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-10">
      <PageHeader
        title="Brand Assets"
        subtitle="Download logos, icons, and splash screens for iOS and Android"
        color="#5046E4"
        icon="🎨"
      />

      {/* ── Logo variants ── */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Logo Files</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Master SVG */}
          <AssetCard
            href="/assets/logo.svg"
            download="shiftsync-logo.svg"
            label="Logo Mark"
            sublabel="SVG · Scalable"
            preview={
              <div className="flex items-center justify-center h-24">
                <Logo size={72} />
              </div>
            }
          />
          {/* Wordmark (color) */}
          <AssetCard
            href="/assets/logo-wordmark.svg"
            download="shiftsync-wordmark.svg"
            label="Wordmark (Color)"
            sublabel="SVG · Light backgrounds"
            preview={
              <div className="flex items-center justify-center h-24 bg-white rounded-lg">
                <Logo size={40} withText />
              </div>
            }
          />
          {/* Wordmark (white) */}
          <AssetCard
            href="/assets/logo-wordmark-white.svg"
            download="shiftsync-wordmark-white.svg"
            label="Wordmark (White)"
            sublabel="SVG · Dark backgrounds"
            preview={
              <div
                className="flex items-center justify-center h-24 rounded-lg"
                style={{ background: 'linear-gradient(135deg, #5046E4, #3B82C4)' }}
              >
                <Logo size={40} withText variant="white" />
              </div>
            }
          />
        </div>
      </section>

      {/* ── PNG Icon pack ── */}
      <section>
        <h2 className="text-lg font-semibold mb-1">PNG Icon Pack</h2>
        <p className="text-sm text-gray-500 mb-4">
          All sizes needed for iOS App Store, Android Play Store, and web PWA.
        </p>
        <div className="flex flex-wrap gap-3">
          {ICON_SIZES.map((size) => (
            <a
              key={size}
              href={`/assets/icons/icon-${size}x${size}.png`}
              download={`shiftsync-icon-${size}x${size}.png`}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all p-3 bg-white dark:bg-gray-900 dark:border-gray-700 group"
              style={{ minWidth: 72 }}
            >
              <img
                src={`/assets/icons/icon-${size}x${size}.png`}
                alt={`${size}×${size} icon`}
                width={Math.min(size, 48)}
                height={Math.min(size, 48)}
                className="rounded"
              />
              <span className="text-xs text-gray-500 group-hover:text-indigo-600 font-medium">
                {size}×{size}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Splash screens ── */}
      <section>
        <h2 className="text-lg font-semibold mb-1">Splash Screens</h2>
        <p className="text-sm text-gray-500 mb-4">
          iOS launch startup images and a universal downloadable splash screen.
        </p>

        {/* Universal downloadable splash */}
        <div className="mb-6">
          <AssetCard
            href="/assets/splash-screen.svg"
            download="shiftsync-splash-screen.svg"
            label="Universal Splash (SVG)"
            sublabel="Scalable · Any size"
            preview={
              <div
                className="flex flex-col items-center justify-center h-32 rounded-lg gap-2"
                style={{ background: 'linear-gradient(135deg, #6B5FED, #5046E4, #3B82C4)' }}
              >
                <Logo size={48} variant="white" />
                <span className="text-white font-bold text-sm tracking-tight">ShiftSync</span>
              </div>
            }
          />
        </div>

        {/* Per-device PNG splash screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SPLASH_SIZES.map(({ file, label, dims }) => (
            <a
              key={file}
              href={`/assets/splash/${file}`}
              download={`shiftsync-${file}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-md transition-all p-3 bg-white dark:bg-gray-900 dark:border-gray-700 group"
            >
              <div
                className="w-10 h-16 rounded flex-shrink-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(160deg, #6B5FED, #3B82C4)' }}
              >
                <Logo size={20} variant="white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate group-hover:text-indigo-600">
                  {label}
                </p>
                <p className="text-xs text-gray-400">{dims} px</p>
              </div>
              <svg className="ml-auto w-4 h-4 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 20 20">
                <path d="M10 3v10m0 0-3-3m3 3 3-3M3 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── helpers ── */

interface AssetCardProps {
  href: string;
  download: string;
  label: string;
  sublabel: string;
  preview: React.ReactNode;
}

function AssetCard({ href, download, label, sublabel, preview }: AssetCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 flex flex-col">
      <div className="p-4">{preview}</div>
      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-400">{sublabel}</p>
        </div>
        <a
          href={href}
          download={download}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 20 20">
            <path d="M10 3v10m0 0-3-3m3 3 3-3M3 17h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Download
        </a>
      </div>
    </div>
  );
}
