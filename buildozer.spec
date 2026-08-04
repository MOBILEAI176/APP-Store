[app]

# (str) Title of your application
title = App Store

# (str) Package name
package.name = appstore

# (str) Package domain (needed for android/ios packaging)
package.domain = com.appstore.local

# (str) Source code where the main.py lives
source.dir = .

# (list) Source files to include
source.include_exts = py,png,jpg,kv,atlas,html,js,css

# (list) Application requirements
# Note: google-play-scraper, beautifulsoup4, requests, and flask-cors added for your server.py
requirements = python3,kivy,flask,flask-cors,requests,beautifulsoup4,google-play-scraper

# (str) Supported orientation (one of landscape, sensorLandscape, portrait or all)
orientation = portrait

# (bool) Indicate if the application should be fullscreen or not
fullscreen = 0

# (list) Permissions
android.permissions = INTERNET

# (list) Services to run in background (Format: service_name:path_to_script)
services = AppServer:app.py

[buildozer]

# (int) Log level (0 = error only, 1 = info, 2 = debug (with command output))
log_level = 2