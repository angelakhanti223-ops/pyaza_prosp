import { createPageReading, publicPagePath, startPageTracking } from './page-read-tracker.js';

const path = publicPagePath(location.pathname);
if (path) startPageTracking(createPageReading(path));
