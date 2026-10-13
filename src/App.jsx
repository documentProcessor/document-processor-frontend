import './App.css'
import UploadPage from './pages/UploadPage'

function App() {
  const navItems = ['Home', 'DashBoard', 'Profile', 'History']

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">Document Processor</div>
        <nav className="auth-links" aria-label="Authentication links">
          <a href="#" className="text-link">Sign In</a>
          <a href="#" className="text-link">Create Account</a>
        </nav>
      </header>

      <div className="main-layout">
        <aside className="sidebar" aria-label="Sidebar navigation">
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <button
                key={item}
                type="button"
                className={`nav-item ${item === 'Home' ? 'active' : ''}`}
                aria-current={item === 'Home' ? 'page' : undefined}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <main className="content-panel">
          {/*
            Sign In, Create Account, Profile, and History are placeholder screens
            deferred to later phases. Auth is Phase 6.
          */}
          <UploadPage />
        </main>
      </div>

      <footer className="footer">
        © 2026 Stanly & Hugo Technologies. All rights reserved.
      </footer>
    </div>
  )
}

export default App
