/**
 * Skeleton — layout-aware shimmer placeholders to replace bare spinners while
 * data loads. Uses the existing `.skeleton` shimmer in index.css (reduced-motion
 * aware). Compose the small pieces, or use the ready-made page/grid presets.
 *
 *   <Skeleton w="60%" h={18} />
 *   <SkeletonCard />
 *   <PageSkeleton />               // hero + stat row + card grid
 *   <SkeletonGrid count={6} />     // card grid only
 */
export const Skeleton = ({ w = '100%', h = 12, r = 8, style }) => (
    <span
        className="skeleton"
        style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }}
    />
);

export const SkeletonText = ({ lines = 3, lastWidth = '70%' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} h={11} w={i === lines - 1 ? lastWidth : '100%'} />
        ))}
    </div>
);

export const SkeletonCard = ({ lines = 3 }) => (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Skeleton w={42} h={42} r={12} />
            <Skeleton w="50%" h={14} />
        </div>
        <SkeletonText lines={lines} />
    </div>
);

export const SkeletonGrid = ({ count = 6, cols = 3 }) => (
    <div className={`grid grid-${cols}`}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
);

export const PageSkeleton = ({ stats = 4, cards = 6 }) => (
    <div className="page">
        <div className="card" style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skeleton w={120} h={12} />
            <Skeleton w="42%" h={26} />
            <Skeleton w="60%" h={13} />
        </div>
        <div className="grid grid-4" style={{ marginBottom: 28 }}>
            {Array.from({ length: stats }).map((_, i) => (
                <div key={i} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Skeleton w="55%" h={11} />
                    <Skeleton w="40%" h={24} />
                </div>
            ))}
        </div>
        <SkeletonGrid count={cards} />
    </div>
);

export default Skeleton;
