import React, { useState, useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navbarRef = useRef(null);
  const menuRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  useEffect(() => {
    if (navbarRef.current) {
      gsap.fromTo(navbarRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
      );
    }
  }, []);

  useEffect(() => {
    if (menuRef.current) {
      if (isMenuOpen) {
        gsap.fromTo(menuRef.current.children,
          { opacity: 0, x: -20 },
          { opacity: 1, x: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" }
        );
      }
    }
  }, [isMenuOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <nav className={`navbar ${darkMode ? 'dark' : ''}`} ref={navbarRef}>
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          EventHub
        </Link>
        <button 
          className="navbar-toggle" 
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className={isMenuOpen ? 'hamburger open' : 'hamburger'}>
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
        <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`} ref={menuRef}>
          {user ? (
            <>
              <Link to="/" className="navbar-link" onClick={closeMenu}>
                Events
              </Link>
              <Link to="/my-dashboard" className="navbar-link" onClick={closeMenu}>
                My Dashboard
              </Link>
              <Link to="/create-event" className="navbar-link" onClick={closeMenu}>
                Create Event
              </Link>
              <button onClick={toggleDarkMode} className="btn-theme-toggle" title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                {darkMode ? '☀️' : '🌙'}
              </button>
              <span className="navbar-user">Hello, {user.name}</span>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navbar-link" onClick={closeMenu}>
                Login
              </Link>
              <Link to="/register" className="btn-register" onClick={closeMenu}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

