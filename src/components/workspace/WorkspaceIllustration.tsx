/**
 * Decorative folder / documents motif for the top-right of the Workspace.
 * Pure CSS/SVG, subtle and semi-transparent — never a bright hero.
 */
export function WorkspaceIllustration() {
  return (
    <div
      className="pointer-events-none relative h-[196px] w-full select-none overflow-hidden"
      aria-hidden
    >
      {/* soft violet glow */}
      <div
        className="absolute right-4 top-6 h-40 w-52"
        style={{
          background:
            'radial-gradient(60% 60% at 60% 45%, rgba(145,71,245,0.28), rgba(145,71,245,0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      <svg
        viewBox="0 0 360 220"
        className="absolute inset-0 h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ws-folder" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9147f5" />
            <stop offset="1" stopColor="#5b2ea8" />
          </linearGradient>
          <linearGradient id="ws-flap" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#a557ff" />
            <stop offset="1" stopColor="#7a3fd6" />
          </linearGradient>
          <linearGradient id="ws-card" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a1f1a" />
            <stop offset="1" stopColor="#1c1512" />
          </linearGradient>
        </defs>

        <g opacity="0.92" transform="translate(150 26)">
          {/* back panel of the folder */}
          <rect x="18" y="70" width="150" height="104" rx="14" fill="url(#ws-folder)" opacity="0.5" />

          {/* floating document cards */}
          <g transform="rotate(-11 60 60)">
            <rect x="18" y="20" width="78" height="98" rx="10" fill="url(#ws-card)" stroke="#3a2b23" />
            <rect x="30" y="34" width="40" height="26" rx="5" fill="#3a2b57" opacity="0.6" />
            <path d="M32 56l9-8 7 6 6-5 8 9" stroke="#a557ff" strokeWidth="1.6" opacity="0.7" fill="none" />
            <circle cx="60" cy="42" r="3.4" fill="#c9a3f5" opacity="0.8" />
            <rect x="30" y="70" width="52" height="4" rx="2" fill="#4a3a32" />
            <rect x="30" y="80" width="40" height="4" rx="2" fill="#3f312a" />
          </g>

          <g transform="rotate(6 130 40)">
            <rect x="96" y="8" width="76" height="96" rx="10" fill="url(#ws-card)" stroke="#3a2b23" />
            <rect x="108" y="22" width="30" height="12" rx="3" fill="rgba(226,104,90,0.85)" />
            <text x="112" y="31" fontFamily="Satoshi, sans-serif" fontSize="8" fontWeight="700" fill="#fff">
              PDF
            </text>
            <rect x="108" y="46" width="52" height="4" rx="2" fill="#4a3a32" />
            <rect x="108" y="56" width="44" height="4" rx="2" fill="#3f312a" />
            <rect x="108" y="66" width="48" height="4" rx="2" fill="#3f312a" />
          </g>

          <g transform="translate(66 -6) rotate(-2)">
            <rect x="60" y="0" width="62" height="60" rx="9" fill="#211713" stroke="#3a2b23" />
            <text
              x="76"
              y="38"
              fontFamily="Satoshi, sans-serif"
              fontSize="22"
              fontWeight="800"
              fill="#c9a3f5"
              opacity="0.85"
            >
              AB
            </text>
          </g>

          {/* front flap of the folder */}
          <path
            d="M12 96h162a8 8 0 0 1 8 8v60a10 10 0 0 1-10 10H14a10 10 0 0 1-10-10v-56a12 12 0 0 1 8-11.3Z"
            fill="url(#ws-flap)"
          />
          <path
            d="M12 96h162a8 8 0 0 1 8 8v6H4v-2.7A12 12 0 0 1 12 96Z"
            fill="#b892ff"
            opacity="0.5"
          />
        </g>
      </svg>
    </div>
  )
}
