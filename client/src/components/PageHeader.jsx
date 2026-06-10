// Consistent page header: an icon chip + title (+ optional subtitle + right-aligned actions).
// Replaces the old emoji-prefixed page titles with a real, uniform pattern.

const PageHeader = ({ icon: Icon, title, subtitle, actions }) => (
    <div className="page-header">
        <div className="page-header-main">
            {Icon && (
                <span className="page-header-icon">
                    <Icon />
                </span>
            )}
            <div>
                <h1 className="page-title-text">{title}</h1>
                {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
    </div>
);

export default PageHeader;
