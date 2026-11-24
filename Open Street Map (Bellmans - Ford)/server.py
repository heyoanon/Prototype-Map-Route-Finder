#!/usr/bin/env python3
"""
Zero-dependency local development and offline PWA server for Prototype Map Route Finder.
Runs out of the box on Windows, macOS, and Linux with standard Python 3.

Features:
- Serves both online & offline on http://localhost:8000 and http://127.0.0.1:8000
- Sends "Service-Worker-Allowed: /" so Service Workers control all pages
- Sets proper MIME types for .webmanifest, .js, .css, .svg, .json
- Automatically routes / and /map to map.html
- Automatically routes /responder and /dispatch to responder.html
- Works whether started from repo root or Open Street Map folder
"""

import http.server
import socketserver
import os
import sys
import mimetypes

PORT = int(os.environ.get('PORT', 8000))

# Ensure correct MIME types
mimetypes.add_type('application/manifest+json', '.webmanifest')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('application/json', '.json')

class LocalhostRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow service worker to control entire scope on localhost
        self.send_header('Service-Worker-Allowed', '/')
        self.send_header('Access-Control-Allow-Origin', '*')
        # Avoid aggressive caching during local development
        if self.path.endswith(('.html', '.js', '.webmanifest')):
            self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0].split('#')[0]

        # Locate base directory for map and responder files
        base_dir = os.getcwd()
        has_local_map = os.path.exists(os.path.join(base_dir, 'map.html'))
        sub_dir = os.path.join(base_dir, 'Open Street Map (Bellmans - Ford)')
        has_sub_map = os.path.exists(os.path.join(sub_dir, 'map.html'))

        # Rewrites for clean URLs
        if clean_path in ('/', '/map', '/map.html'):
            if has_local_map:
                self.path = '/map.html'
            elif has_sub_map:
                self.path = '/Open Street Map (Bellmans - Ford)/map.html'

        elif clean_path in ('/responder', '/dispatch', '/responder.html', '/responder-dispatch'):
            if has_local_map and os.path.exists(os.path.join(base_dir, 'responder.html')):
                self.path = '/responder.html'
            elif has_sub_map:
                self.path = '/Open Street Map (Bellmans - Ford)/responder.html'

        elif clean_path == '/service-worker.js':
            if os.path.exists(os.path.join(base_dir, 'service-worker.js')):
                self.path = '/service-worker.js'
            elif has_sub_map:
                self.path = '/Open Street Map (Bellmans - Ford)/service-worker.js'

        return super().do_GET()

def run_server(port=PORT):
    handler = LocalhostRequestHandler
    # Allow port reuse immediately
    socketserver.TCPServer.allow_reuse_address = True
    
    server_started = False
    for p in range(port, port + 10):
        try:
            with socketserver.TCPServer(('0.0.0.0', p), handler) as httpd:
                print("=" * 60)
                print(" Prototype Map Route Finder - Local Server (Online & Offline)")
                print("=" * 60)
                print(f" Localhost URL:      http://localhost:{p}")
                print(f" Loopback IP URL:    http://127.0.0.1:{p}")
                print(f" Map Interface:      http://localhost:{p}/map.html")
                print(f" Responder Console:  http://localhost:{p}/responder.html")
                print("=" * 60)
                print(" [Ctrl+C] to stop server.\n")
                server_started = True
                httpd.serve_forever()
        except OSError as e:
            if 'Address already in use' in str(e) or '10048' in str(e):
                continue
            else:
                raise e

if __name__ == '__main__':
    run_server()
