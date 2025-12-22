// src/components/Sidebar.jsx
import React, { useState } from "react";

function Sidebar({ open, onClose }) {
  const [constellationsOpen, setConstellationsOpen] = useState(true);

  const handleNav = (target) => {
    // For now, just log the intent.
    // Later you can hook this into routing / page state.
    console.log("Navigate to:", target);
    onClose();
  };

  const constellationItems = [
    { id: "mind", label: "Mind", element: "Air" },
    { id: "body", label: "Body", element: "Earth" },
    { id: "will", label: "Will", element: "Fire" },
    { id: "spirit", label: "Spirit", element: "Water" },
  ];

  return (
    <>
      {/* dimmed background */}
      <div
        className={`sidebar-overlay ${open ? "is-open" : ""}`}
        onClick={onClose}
      />

      {/* sliding panel */}
      <aside className={`sidebar-panel ${open ? "is-open" : ""}`}>
        <header className="sidebar-header">
          <div className="sidebar-title-block">
            <div className="sidebar-app-title">New Year Sky</div>
            <div className="sidebar-app-subtitle">Navigate your map</div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </header>

        <nav className="sidebar-nav">
          {/* Constellations tab */}
          <section className="sidebar-section">
            <button
              type="button"
              className="sidebar-nav-button sidebar-nav-parent"
              onClick={() => setConstellationsOpen((v) => !v)}
            >
              <span>Constellations</span>
              <span
                className={`sidebar-chevron ${
                  constellationsOpen ? "open" : ""
                }`}
              >
                ▾
              </span>
            </button>

            {constellationsOpen && (
              <div className="sidebar-subnav">
                {constellationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="sidebar-subnav-button"
                    onClick={() =>
                      handleNav(`constellations/${item.id}`)
                    }
                  >
                    <span
                      className={`sidebar-dot sidebar-dot-${item.id}`}
                    />
                    <span className="sidebar-subnav-label">
                      {item.label}
                    </span>
                    <span className="sidebar-subnav-element">
                      {item.element}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Achievements tab */}
          <section className="sidebar-section">
            <button
              type="button"
              className="sidebar-nav-button"
              onClick={() => handleNav("achievements")}
            >
              <span>Achievements</span>
            </button>
          </section>

          {/* Night Sky tab */}
          <section className="sidebar-section">
            <button
              type="button"
              className="sidebar-nav-button"
              onClick={() => handleNav("night-sky")}
            >
              <span>Night Sky</span>
            </button>
          </section>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;
