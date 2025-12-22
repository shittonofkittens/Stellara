// src/App.jsx
import React, { useState } from "react";
import "./App.css";
import "./styles/journal.css";
import CategoryCard from "./components/CategoryCard";
import Sidebar from "./components/Sidebar";
import SubcategoryPage from "./components/SubcategoryShell";
import JournalSubcategoryPage from "./components/JournalSubcategoryPage";
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/subcategory.css";
import "./styles/journal.css";

// --- Temporary demo data ---
// Later we'll load this from your real JSON (stars + tokens per domain).
const DASHBOARD_DATA = {
  mind: {
    id: "mind",
    label: "Mind",
    element: "Air",
    color: "#f5f5f8", // soft cloud-white
    totalStars: 27.4,
    tokens: 3,
    soul: "Orrie",
    subcategories: [
      {
        id: "journal",
        label: "Journal",
        currentStars: 14,
        monthMaxStars: 93,
        fragmentsPerDay: 0.6, // up to 3/5
        completedToday: false,
        // each entry: { fraction: 0–1, usedToken: boolean }
        starHistory: [
          { fraction: 1.0, usedToken: false },
          { fraction: 1.0, usedToken: false },
          { fraction: 1.0, usedToken: false },
          { fraction: 1.0, usedToken: false },
          { fraction: 0.4, usedToken: true },
        ],
      },
      {
        id: "therapy",
        label: "Therapy",
        currentStars: 6,            // 6 fragments = 3 half-stars = 3 sessions
        monthMaxStars: 6,
        fragmentsPerDay: 0.5,       // 0.5 star per session
        completedToday: true,
        starHistory: [
          {
            // first star: full, both halves earned without tokens
            halves: ["gold", "gold"],
          },
          {
            // second star: full, token used on the second half
            halves: ["gold", "silver"],
          },
          {
            // current star: only first half earned so far (one session)
            halves: ["gold"],       // second half missing → partial star
          },
        ],
      },
      {
        id: "meditation",
        label: "Meditation / Reading",
        currentStars: 7.4,
        monthMaxStars: 24,
        fragmentsPerDay: 0.5,
        completedToday: false,
        starHistory: [
          { fraction: 0.5, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.5, usedToken: false },
        ],
      },
    ],
  },
  body: {
    id: "body",
    label: "Body",
    element: "Earth",
    color: "#9fcf70", // softer earth green
    totalStars: 31.2,
    tokens: 4,
    soul: "Thal",
    subcategories: [
      {
        id: "movement",
        label: "Movement",
        currentStars: 18.2,
        monthMaxStars: 93,
        fragmentsPerDay: 0.6,
        completedToday: true,
        starHistory: [
          { fraction: 0.6, usedToken: false },
          { fraction: 0.4, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.6, usedToken: true },
          { fraction: 0.0, usedToken: false },
        ],
      },
      {
        id: "nourish",
        label: "Nourish",
        currentStars: 7.2,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: false,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
          { fraction: 0.0, usedToken: false },
        ],
      },
      {
        id: "hygiene",
        label: "Hygiene",
        currentStars: 5.8,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: true,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
        ],
      },
    ],
  },
  will: {
    id: "will",
    label: "Will",
    element: "Fire",
    color: "#ff9566", // softer ember
    totalStars: 43.1,
    tokens: 5,
    soul: "Cael",
    subcategories: [
      {
        id: "school",
        label: "School Work",
        currentStars: 16.5,
        monthMaxStars: 40,
        fragmentsPerDay: 0.5,
        completedToday: false,
        starHistory: [
          { fraction: 0.5, usedToken: false },
          { fraction: 0.5, usedToken: false },
          { fraction: 0.0, usedToken: false },
        ],
      },
      {
        id: "grades",
        label: "Good Grades",
        currentStars: 10,
        monthMaxStars: 10,
        fragmentsPerDay: 10,
        completedToday: false,
        starHistory: [{ fraction: 1, usedToken: false }],
      },
      {
        id: "extended",
        label: "Extended Learning",
        currentStars: 6.6,
        monthMaxStars: 48,
        fragmentsPerDay: 0.4,
        completedToday: true,
        starHistory: [
          { fraction: 0.4, usedToken: false },
          { fraction: 0.4, usedToken: true },
          { fraction: 0.4, usedToken: false },
        ],
      },
      {
        id: "projects",
        label: "Projects",
        currentStars: 6.6,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: true,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
          { fraction: 0.0, usedToken: false },
        ],
      },
    ],
  },
  spirit: {
    id: "spirit",
    label: "Spirit",
    element: "Water",
    color: "#9ac3f1", // softer water blue
    totalStars: 28.7,
    tokens: 2,
    soul: "Ky",
    subcategories: [
      {
        id: "mirror",
        label: "Mirror Work",
        currentStars: 8.2,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: false,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
        ],
      },
      {
        id: "chores",
        label: "Chores",
        currentStars: 12.4,
        monthMaxStars: 62,
        fragmentsPerDay: 0.4,
        completedToday: true,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.4, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.4, usedToken: true },
        ],
      },
      {
        id: "soulcare",
        label: "Soul Care",
        currentStars: 8.1,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: false,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.0, usedToken: false },
        ],
      },
    ],
  },
};

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // null = show dashboard
  // otherwise: { categoryId, subcategoryId }
  const [activeSubcategory, setActiveSubcategory] = useState(null);
  
  // 🔹 global low-energy flag for *today*
  const [lowEnergy, setLowEnergy] = useState(false);

  const handleOpenSubcategory = (categoryId, subcategoryId) => {
    setActiveSubcategory({ categoryId, subcategoryId });
  };

  const handleBackToDashboard = () => {
    setActiveSubcategory(null);
  };

  // If a subcategory is active, render its page instead of the dashboard
  if (activeSubcategory) {
    const { categoryId, subcategoryId } = activeSubcategory;
    const category = DASHBOARD_DATA[categoryId];
    const subcategory = category.subcategories.find(
      (s) => s.id === subcategoryId
    );

    if (!category || !subcategory) {
      // Fallback in case of bad IDs
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <header className="app-header">
            <button
              className="sidebar-toggle"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="title-block">
              <h1 className="app-title">New Year Sky</h1>
              <p className="app-subtitle">
                Stars, constellations, and rest woven into one map.
              </p>
            </div>
          </header>
          <main className="app-main">
            <p className="error-text">
              Could not load this tracker.{" "}
              <button
                type="button"
                className="link-button"
                onClick={handleBackToDashboard}
              >
                Return to dashboard
              </button>
            </p>
          </main>
        </div>
      );
    }

    // Mind → Journal uses the dedicated journal page (with lowEnergy tracking)
    if (categoryId === "mind" && subcategoryId === "journal") {
      return (
        <div className="app-shell">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <JournalSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    // All other subcategories use the generic shell for now
    return (
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <SubcategoryPage
          category={category}
          subcategory={subcategory}
          onBack={handleBackToDashboard}
        />
      </div>
    );
  }

    // Dashboard view
    return (
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              <header className="app-header">
                <button
                  className="sidebar-toggle"
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>

                <div className="title-block">
                  <h1 className="app-title">Stellara</h1>
                </div>

                {/* 🔹 Low-energy toggle lives in the header on the right */}
                <button
                  type="button"
                  className={`low-energy-toggle ${lowEnergy ? "is-on" : ""}`}
                  onClick={() => setLowEnergy((prev) => !prev)}
                >
                  <span className="low-energy-dot" />
                  <span className="low-energy-label">
                    {lowEnergy ? "Low-energy day" : "Normal energy"}
                  </span>
                </button>
              </header>

        <main className="app-main">
          {Object.values(DASHBOARD_DATA).map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onOpenSubcategory={handleOpenSubcategory}
            />
          ))}
        </main>
      </div>
    );
}

export default App;