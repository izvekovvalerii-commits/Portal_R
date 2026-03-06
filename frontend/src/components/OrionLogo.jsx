export default function OrionLogo({ collapsed }) {
  return (
    <div className="orion-logo sidebar-title" aria-label="Орион">
      <span className="sidebar-title-short orion-logo-short" aria-hidden={!collapsed}>
        O
      </span>
      <span className="sidebar-title-full orion-logo-full" aria-hidden={collapsed}>
        <span className="orion-logo-word">Orion</span>
        <span className="orion-logo-stars" aria-hidden="true">
          <span className="orion-star">★</span>
          <span className="orion-star">★</span>
          <span className="orion-star">★</span>
          <span className="orion-star">★</span>
          <span className="orion-star">★</span>
        </span>
      </span>
    </div>
  );
}
