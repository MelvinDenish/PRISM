import { useReducer } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

// The DOM (<html data-theme>) is the source of truth (initialised pre-paint in index.html).
// We read it on each render and mutate it directly on toggle, then force a re-render for the icon.
const currentTheme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

const ThemeToggle = () => {
    const [, force] = useReducer((x) => x + 1, 0);
    const theme = currentTheme();

    const toggle = () => {
        const next = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('prism_theme', next); } catch { /* ignore */ }
        force();
    };

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            <span className="theme-toggle-track">
                <span className="theme-toggle-thumb">
                    {theme === 'dark' ? <FiMoon /> : <FiSun />}
                </span>
            </span>
        </button>
    );
};

export default ThemeToggle;
