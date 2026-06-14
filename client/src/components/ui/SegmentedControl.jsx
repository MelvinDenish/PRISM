import { motion } from 'framer-motion';

/**
 * SegmentedControl — tab / filter switch with a framer `layoutId` sliding pill
 * (same shared-element technique as the sidebar active bar). Standardizes the
 * `.tabs` / filter-chip pattern across pages.
 *
 *   <SegmentedControl
 *     value={tab}
 *     onChange={setTab}
 *     options={[{ value: 'all', label: 'All' }, { value: 'video', label: 'Videos', count: 12 }]}
 *   />
 *
 * `id` must be unique per control instance on a page (keeps layoutId pills separate).
 */
const SegmentedControl = ({ value, onChange, options, id = 'seg', size = 'md' }) => {
    return (
        <div className={`segmented segmented--${size}`} role="tablist">
            {options.map((opt) => {
                const active = opt.value === value;
                return (
                    <button
                        key={opt.value}
                        role="tab"
                        aria-selected={active}
                        className={`segmented-item ${active ? 'active' : ''}`}
                        onClick={() => onChange(opt.value)}
                    >
                        {active && (
                            <motion.span
                                layoutId={`segmented-pill-${id}`}
                                className="segmented-pill"
                                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                            />
                        )}
                        <span className="segmented-label">
                            {opt.icon && <span className="segmented-icon">{opt.icon}</span>}
                            {opt.label}
                            {typeof opt.count === 'number' && <span className="segmented-count">{opt.count}</span>}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default SegmentedControl;
