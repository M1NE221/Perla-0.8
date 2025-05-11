# Changelog

## Version 0.8.1 (Unreleased)

### Bug Fixes
- Fixed incorrect date format in sales records by properly formatting ISO date strings
- Added missing `/insights` endpoint to the backend server to fix 404 errors
- Fixed verification process for sales count after timeout

### Code Cleanup
- Removed unused `src-tauri` directory
- Removed landing page download example file
- Removed unused build artifacts from `.next` directory 
- Cleaned up redundant icon files in output directory

### Next Steps
- Add comprehensive error handling for all API endpoints
- Implement proper logging throughout the application
- Add tests to verify date handling and API endpoints
- Review and optimize icon management to reduce file size 