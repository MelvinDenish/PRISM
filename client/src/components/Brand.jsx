// PRISM brand mark — a prism refracting a single beam into a gold→orange spectrum.
// Custom SVG (no emoji, no letter-in-a-box). Crisp from 20px to 48px.

export const BrandMark = ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
        <defs>
            <linearGradient id="prismFill" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
                <stop stopColor="#DDB85E" />
                <stop offset="1" stopColor="#C9A24B" />
            </linearGradient>
        </defs>
        {/* incoming beam */}
        <path d="M2 19 H14" stroke="#F4F0E8" strokeOpacity="0.4" strokeWidth="2.2" strokeLinecap="round" />
        {/* prism body */}
        <path d="M19 6.5 L33.5 31 H4.5 Z" fill="url(#prismFill)" stroke="#A8843A" strokeWidth="1.4" strokeLinejoin="round" />
        {/* internal refraction edge */}
        <path d="M19 6.5 L21.5 31" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
        {/* refracted spectrum rays — warm gold → orange */}
        <path d="M30 21 L39 18.5" stroke="#DDB85E" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M30.5 24 L39 23.5" stroke="#E2682A" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M31 27 L39 28.5" stroke="#C5551E" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
);

export const Brand = ({ size = 32, showText = true }) => (
    <div className="brand-lockup">
        <BrandMark size={size} />
        {showText && <span className="brand-wordmark">PRISM</span>}
    </div>
);

export default Brand;
